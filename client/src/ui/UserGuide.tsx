import { useEffect, useRef, useState, type ReactNode } from 'react';
import { closeOverlay } from './Overlays';
import { chapterIndex, parseInline, roman, stepChapter, type GuideBlock } from './guideBook';
import { IconText } from './Icon';
import { CHAPTERS } from './userGuideChapters';
import './userGuide.css';

// The User Guide (B): an old book opened on the table. Contents on the left page, the chapter on the right;
// one page with the contents on top on narrow screens. ← and → turn chapters, Esc or B closes it.

/** The chapter you were reading, so the book opens where you left it (this visit only). */
let lastRead = 0;

function Line({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((r, i) =>
        r.kind === 'key' ? <kbd key={i}>{r.text}</kbd> : r.kind === 'code' ? <code key={i}>{r.text}</code> : r.kind === 'bold' ? <b key={i}><IconText text={r.text} /></b> : <span key={i}><IconText text={r.text} /></span>,
      )}
    </>
  );
}

function Block({ block }: { block: GuideBlock }): ReactNode {
  switch (block.kind) {
    case 'p':
      return (
        <p>
          <Line text={block.text} />
        </p>
      );
    case 'h':
      return <h3>{block.text}</h3>;
    case 'list':
      return (
        <ul>
          {block.items.map((item, i) => (
            <li key={i}>
              <Line text={item} />
            </li>
          ))}
        </ul>
      );
    case 'keys':
      return (
        <table className="ug-keys">
          <tbody>
            {block.rows.map(([k, what]) => (
              <tr key={k}>
                <th scope="row">{k}</th>
                <td>
                  <Line text={what} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );
  }
}

export function UserGuide({ chapter }: { chapter?: string }) {
  const [index, setIndex] = useState(() => (chapter ? chapterIndex(CHAPTERS, chapter) : lastRead));
  const page = useRef<HTMLDivElement>(null);
  const book = useRef<HTMLDivElement>(null);
  const count = CHAPTERS.length;
  const turn = (delta: number) => setIndex((i) => stepChapter(i, delta, count));

  useEffect(() => {
    lastRead = index;
    page.current?.scrollTo({ top: 0 });
  }, [index]);

  useEffect(() => {
    book.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === 'Escape' || (e.code === 'KeyB' && !e.repeat)) {
        e.preventDefault();
        closeOverlay();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setIndex((i) => stepChapter(i, -1, count));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setIndex((i) => stepChapter(i, 1, count));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [count]);

  const ch = CHAPTERS[index];
  const prev = index > 0 ? CHAPTERS[index - 1] : null;
  const next = index < count - 1 ? CHAPTERS[index + 1] : null;

  return (
    <div className="overlay ug-overlay" onMouseDown={(e) => e.target === e.currentTarget && closeOverlay()}>
      <div className="ug-book" ref={book} tabIndex={-1} role="dialog" aria-modal="true" aria-label="User Guide">
        <button className="ug-close" onClick={closeOverlay} aria-label="Close the User Guide" title="Close (Esc)">
          ✕
        </button>
        <div className="ug-spread">
          <nav className="ug-page ug-left" aria-label="Contents">
            <div className="ug-title">User Guide</div>
            <div className="ug-subtitle">Code Dungeon, for the Overlord</div>
            <div className="ug-contents-head">Contents</div>
            <ol className="ug-toc">
              {CHAPTERS.map((c, i) => (
                <li key={c.id}>
                  <button className={`ug-toc-item ${i === index ? 'ug-toc-on' : ''}`} aria-current={i === index ? 'page' : undefined} onClick={() => setIndex(i)}>
                    <span className="ug-toc-num">{roman(i + 1)}</span>
                    <span className="ug-toc-title">{c.title}</span>
                  </button>
                </li>
              ))}
            </ol>
            <div className="ug-left-foot">
              <kbd>B</kbd> opens this book anywhere · <kbd>←</kbd> <kbd>→</kbd> turn chapters
            </div>
          </nav>
          <article className="ug-page ug-right" aria-labelledby="ug-chapter-title">
            <div className="ug-scroll" ref={page}>
              <div className="ug-eyebrow">Chapter {roman(index + 1)}</div>
              <h2 id="ug-chapter-title" className="ug-chapter-title">
                {ch.title}
              </h2>
              <div className="ug-body" key={ch.id}>
                {ch.blocks.map((b, i) => (
                  <Block key={i} block={b} />
                ))}
              </div>
            </div>
            <div className="ug-turn">
              <button className="ug-turn-btn" disabled={!prev} onClick={() => turn(-1)} title={prev ? prev.title : undefined}>
                ← {prev ? `Chapter ${roman(index)}` : 'Previous'}
              </button>
              <span className="ug-folio">
                {index + 1} of {count}
              </span>
              <button className="ug-turn-btn" disabled={!next} onClick={() => turn(1)} title={next ? next.title : undefined}>
                {next ? `Chapter ${roman(index + 2)}` : 'Next'} →
              </button>
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}
