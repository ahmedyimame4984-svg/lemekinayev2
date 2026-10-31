'use client';

import React from 'react';
import Select, {
  type Props as SelectProps,
  components,
  type StylesConfig,
  type DropdownIndicatorProps,
} from 'react-select';
import { ChevronRight } from 'lucide-react';

export interface IOption {
  label: string;
  value: string | number;
}

const DropdownIndicator = (props: DropdownIndicatorProps<IOption, false>) => (
  <components.DropdownIndicator {...props}>
    <ChevronRight className="h-4 w-4 rotate-90 text-gray-400" />
  </components.DropdownIndicator>
);

export interface ReactSelectProps extends Omit<
  SelectProps<IOption, false>,
  'onChange' | 'value'
> {
  label?: string;
  error?: string;
  className?: string;
  placeholder?: string;
  options: IOption[];
  value?: IOption | string | number | null;
  onChange: (option: IOption | null) => void;
  isDisabled?: boolean;
}

const customStyles: StylesConfig<IOption, false> = {
  control: (base, state) => ({
    ...base,
    backgroundColor: 'white',
    borderColor: state.isFocused ? '#A71920' : '#e5e7eb',
    borderWidth: '1px',
    borderRadius: '0.5rem',
    boxShadow: state.isFocused ? '0 0 0 2px rgba(167,25,32,0.18)' : 'none',
    '&:hover': { borderColor: '#A71920' },
    padding: '0.125rem 0',
    minHeight: '40px',
  }),
  placeholder: (base) => ({ ...base, fontSize: '0.875rem', color: '#9ca3af' }),
  singleValue: (base) => ({
    ...base,
    fontSize: '0.875rem',
    fontWeight: 500,
    color: '#15171B',
  }),
  option: (base, { isFocused, isSelected }) => ({
    ...base,
    backgroundColor: isSelected ? '#A71920' : isFocused ? '#FCE4E5' : 'white',
    color: isSelected ? 'white' : isFocused ? '#A71920' : '#15171B',
    fontSize: '0.875rem',
    cursor: 'pointer',
  }),
  menu: (base) => ({
    ...base,
    borderRadius: '0.5rem',
    overflow: 'hidden',
    zIndex: 60,
    boxShadow:
      '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
  }),
  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
  indicatorSeparator: () => ({ display: 'none' }),
};

export const ReactSelect = ({
  label,
  error,
  className = '',
  options,
  placeholder = 'Select...',
  value,
  onChange,
  isDisabled = false,
  isClearable = true,
  menuPortalTarget,
  ...rest
}: ReactSelectProps) => {
  const generatedInputId = React.useId();
  const inputId = rest.inputId ?? generatedInputId;
  const selectedOption: IOption | null = React.useMemo(() => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'object') return value;
    return options.find((option) => option.value === value) ?? null;
  }, [value, options]);

  return (
    <div className={`w-full ${className}`}>
      {label ? (
        <label
          htmlFor={inputId}
          className="mb-1.5 block px-1 text-[10px] font-bold uppercase tracking-wider text-gray-400"
        >
          {label}
        </label>
      ) : null}
      <Select<IOption, false>
        inputId={inputId}
        components={{ DropdownIndicator }}
        styles={customStyles}
        options={options}
        placeholder={placeholder}
        value={selectedOption}
        onChange={onChange}
        isDisabled={isDisabled}
        isClearable={isClearable}
        isSearchable
        menuPortalTarget={
          menuPortalTarget !== undefined
            ? menuPortalTarget
            : typeof document !== 'undefined'
              ? document.body
              : null
        }
        {...rest}
      />
      {error ? (
        <p className="mt-1.5 px-1 text-xs font-medium text-red-500">{error}</p>
      ) : null}
    </div>
  );
};

export default ReactSelect;
