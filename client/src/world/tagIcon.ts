// The woodcut icon at the start of a name tag: what the person is doing, or what they are when idle.
import type { Agent } from '../store';
import type { IconName } from '../ui/icons';

export function tagIcon(agent: Pick<Agent, 'status' | 'role' | 'currentTool'>): IconName {
  switch (agent.status) {
    case 'working':
      if (agent.currentTool?.startsWith('mcp__playwright')) return 'globe';
      if (agent.currentTool === 'Bash' || agent.currentTool === 'PowerShell') return 'hammer';
      return agent.currentTool ? 'quill' : 'candle';
    case 'preparing':
      return 'chest';
    case 'done':
      return 'check';
    case 'error':
      return 'warning';
    case 'stopped':
      return 'hourglass';
    default:
      return agent.role === 'qa' ? 'flask' : agent.role === 'ceo' ? 'crown' : 'mug';
  }
}
