import { ValueState } from '@/store/standard/base';
import { Select, SelectProps } from '@chakra-ui/react';
export interface TimeRangePick {
  props?: SelectProps ;
  onChange: (step:string) => void;
}



export const TimeRangePick = ({props, onChange}: TimeRangePick) => {
  return (
    <Select
      size="sm"
      w="200px"
      outline="none"
      borderColor="#9d7cfc"
      _hover={{ borderColor: '#9d7cfc' }}
      {...props}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v);
      }}
    >
      <option value="day">Daily</option>
      <option value="week">Weekly</option>
      <option value="month">Monthly</option>
    </Select>
  );
};
