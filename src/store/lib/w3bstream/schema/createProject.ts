import { JSONValue, JSONSchemaState, JSONSchemaModalState } from '@/store/standard/JSONSchemaState';
import { FromSchema } from 'json-schema-to-ts';
import { showNotification } from '@mantine/notifications';
import { eventBus } from '@/lib/event';
import { axios } from '@/lib/axios';
import { gradientButtonStyle } from '@/lib/theme';

export const schema = {
  // title: 'Create Project',
  type: 'object',
  properties: {
    name: { type: 'string', title: 'Name' }
  },
  required: ['name', 'version']
} as const;

type SchemaType = FromSchema<typeof schema>;

type ExtraDataType = {
  modal: JSONSchemaModalState;
};

export class CreateProjectSchema extends JSONSchemaState<SchemaType, ExtraDataType> {
  constructor(args: Partial<CreateProjectSchema> = {}) {
    super(args);
    this.init({
      //@ts-ignore
      schema,
      uiSchema: {
        'ui:submitButtonOptions': {
          norender: false,
          submitText: 'Submit',
          props: {
            w: '100%',
            h: '32px',
            ...gradientButtonStyle
          }
        }
      },

      afterSubmit: async (e) => {
        const res = await axios.request({
          method: 'post',
          url: '/srv-applet-mgr/v0/project',
          data: e.formData
        });
        if (res.data) {
          await showNotification({ message: 'create project successed' });
          eventBus.emit('project.create');
          this.reset().extraValue.set({ modal: { show: false } });
        }
      },
      value: new JSONValue<SchemaType>({
        default: {
          name: 'project_01',
          version: '0.0.1'
        }
      }),
      extraValue: new JSONValue<ExtraDataType>({
        default: {
          modal: { show: false, title: 'Create Project' }
        }
      })
    });
  }
}
