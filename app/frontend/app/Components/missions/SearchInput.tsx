
import { Search, XCircle } from 'lucide-react';

type Props = {
  value: string;
  onChange: (v: string) => void;
  onClear: () => void;
};

export default function SearchInput({ value, onChange, onClear }: Props) {
  return (
    <div className="relative flex-1">
      {/* 1. The Search Icon */}
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
      
      {/* 2. The Input Field */}
      <input
        type="text"
        placeholder="Search missions, tags..."
        value={value} // Use 'value' from props
        onChange={(e) => onChange(e.target.value)} // Use 'onChange' from props
        className="w-full pl-9 pr-4 py-2.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
      />
      
      {/* 3. The Clear Button */}
      {value && ( // Show if 'value' is not empty
        <button 
          onClick={onClear} // Use 'onClear' from props
          className="absolute right-3 top-1/2 -translate-y-1/2"
        >
          <XCircle className="w-4 h-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" />
        </button>
      )}
    </div>
  );
}