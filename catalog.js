// App metadata stays separate from layout. Each id is a stable future launch target.
const CATEGORIES = ['All', 'Games', 'Tools', 'Productivity', 'Study', 'Finance', 'Creative'];
const APPS = [
  { id: '2048', name: '2048', category: 'Games', detail: 'Puzzle · Game', icon: '2048', tone: 'sand', recent: 'Played 2h ago' },
  { id: 'planner', name: 'Study Planner', category: 'Study', detail: 'Plan your next small step.', icon: 'calendar', tone: 'blue', recent: 'Opened 4h ago' },
  { id: 'savings', name: 'Savings Tracker', category: 'Finance', detail: 'A little closer to your goals.', icon: 'pig', tone: 'teal', recent: 'Opened 6h ago' },
  { id: 'tetris', name: 'Tetris', category: 'Games', detail: 'Arcade · Game', icon: 'tetris', tone: 'navy', recent: 'Played 1d ago' },
  { id: 'pomodoro', name: 'Pomodoro', category: 'Productivity', detail: 'Make room for focused work.', icon: 'tomato', tone: 'red', recent: 'Opened 1d ago' },
  { id: 'minesweeper', name: 'Minesweeper', category: 'Games', detail: 'Strategy · Game', icon: 'gear', tone: 'slate', recent: 'Played 2d ago' },
  { id: 'snake', name: 'Snake', category: 'Games', detail: 'Classic · Game', icon: 'snake', tone: 'green', explore: true },
  { id: 'sudoku', name: 'Sudoku', category: 'Games', detail: 'Logic · Game', icon: 'sudoku', tone: 'blue', explore: true },
  { id: 'notepad', name: 'NotePad', category: 'Tools', detail: 'Notes · Tool', icon: 'note', tone: 'sky', explore: true },
  { id: 'habits', name: 'Habit Tracker', category: 'Productivity', detail: 'Productivity', icon: 'chart', tone: 'orange', explore: true },
  { id: 'currency', name: 'Currency Converter', category: 'Finance', detail: 'Finance · Tool', icon: 'arrows', tone: 'purple', explore: true },
  { id: 'breakout', name: 'Breakout', category: 'Games', detail: 'Arcade · Game', icon: 'breakout', tone: 'navy', explore: true }
];
const QUICK = [
  { name: 'Play a Game', detail: 'Take a break', icon: 'game', tone: 'blue', category: 'Games' },
  { name: 'Open Study Planner', detail: 'Stay on track', icon: 'checklist', tone: 'teal', app: 'planner' },
  { name: 'Track Savings', detail: 'Build your goals', icon: 'wallet', tone: 'green', app: 'savings' },
  { name: 'All Tools', detail: 'Explore more', icon: 'grid', tone: 'purple', category: 'Tools' }
];
