import React, { useEffect, useState } from 'react';
import { WidgetProps } from '@rjsf/utils';
import { Text, Flex, chakra, FlexProps, Input, Button } from '@chakra-ui/react';
import { defaultButtonStyle } from '@/lib/theme';

type Options = {
  tags: string[];
  flexProps?: FlexProps;
};

export interface SelectTagWidgetProps extends WidgetProps {
  options: Options;
}

export interface SelectTagWidgetUIOptions {
  'ui:widget': (props: SelectTagWidgetProps) => JSX.Element;
  'ui:options': Options;
}

function SelectTagWidget({ id, options, value, required, label, onChange }: SelectTagWidgetProps) {
  const [tags, setTags] = useState(options.tags || []);
  const [selectedTags, setSelectedTags] = useState([]);
  const [addingTagState, setSddingTagState] = useState<'DEFAULT' | 'INPUTTING'>('DEFAULT');
  const [inputV, setInputV] = useState('');
  const { flexProps = {} } = options;

  useEffect(() => {
    onChange(selectedTags.join(','));
  }, [selectedTags]);

  return (
    <>
      <Flex alignItems="center" justifyContent="space-between" position={'relative'}>
        {/* <Text>{label}</Text>
        {required && (
          <chakra.span ml="0.25rem" color="#D34B46">
            *
          </chakra.span>
        )} */}
        <Flex flex={1} position="absolute" right={0} top="-30px" mr="5px" alignItems="center" justifyContent={'flex-end'}>
          {addingTagState === 'DEFAULT' && (
            <Button
              size={'sm'}
              {...defaultButtonStyle}
              fontSize={"12px"}
              onClick={() => {
                setSddingTagState('INPUTTING');
              }}
            >
              Create a new tag
            </Button>
          )}
          {addingTagState === 'INPUTTING' && (
            <>
              <Input
                size="sm"
                _focus={{
                  border: '1px solid #946FFF',
                  outline: 'none'
                }}
                value={inputV}
                onChange={(e) => {
                  const v = e.target.value;
                  v && setInputV(v);
                }}
              />
              <Button
                ml="10px"
                h="30px"
                size="sm"
                fontSize={"12px"}
                {...defaultButtonStyle}
                onClick={() => {
                  if (inputV) {
                    setTags([...tags, inputV]);
                    setSddingTagState('DEFAULT');
                  }
                }}
              >
                Submit
              </Button>
            </>
          )}
        </Flex>
      </Flex>
      <Flex mt="10px" id={id} flexWrap="wrap" {...flexProps}>
        {tags.map((tag) => {
          const selected = selectedTags.includes(tag);
          return (
            <Flex
              key={tag}
              mb="5px"
              mr="5px"
              p="5px 10px"
              alignItems="center"
              color={selected ? '#946FFF' : '#000'}
              border={selected ? '1px solid #946FFF' : '1px solid #EDEDED'}
              borderRadius="6px"
              cursor="pointer"
              onClick={() => {
                const index = selectedTags.findIndex((selectedTag) => selectedTag === tag);
                if (index === -1) {
                  setSelectedTags([...selectedTags, tag]);
                } else {
                  setSelectedTags(selectedTags.filter((selectedTag) => selectedTag !== tag));
                }
              }}
            >
              <Text fontSize={"12px"}>{tag}</Text>
            </Flex>
          );
        })}
      </Flex>
    </>
  );
}

export default SelectTagWidget;
