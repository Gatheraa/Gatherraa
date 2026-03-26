type SortOption = 'newest' | 'reward-high' | 'reward-low';

type Props = {
  value: SortOption; // Change from string to SortOption
  onChange: (v: SortOption) => void; // Change from string to SortOption
};

export default function SortSelect({ value, onChange }: Props) {
  return (
    <select
      value={value}
      // We "cast" the value here because HTML selects always return strings
      onChange={(e) => onChange(e.target.value as SortOption)}
      className="px-3 py-2.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer"
    >
      <option value="newest">Newest</option>
      <option value="reward-high">Reward: High → Low</option>
      <option value="reward-low">Reward: Low → High</option>
    </select>
  );
}