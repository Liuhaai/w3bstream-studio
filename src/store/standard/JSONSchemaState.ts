import React from 'react';
import { UiSchema, RJSFSchema } from '@rjsf/utils';
import { makeAutoObservable, observable, makeObservable, computed, action, reaction, toJS } from 'mobx';
import validator from '@rjsf/validator-ajv6';
import { IChangeEvent, FormState, FormProps } from '@rjsf/core';
import { _ } from '../../lib/lodash';

export class JSONSchemaState<T> {
  extraData = new JSONValue();
  value: JSONSchemaValue = new JSONValue();

  // formData: T = {} as T;
  get formData() {
    return this.value.get();
  }
  set formData(value: T) {
    this.value.set(value);
  }
  schema: RJSFSchema;
  uiSchema: UiSchema;
  reactive: boolean;
  readonly = false;
  liveValidate = false;
  validator = validator;

  get dynamicData() {
    return this.getDymaicData();
  }
  getDymaicData = () => {
    return { ready: true };
  };

  onChange = (e: IChangeEvent<T, any>) => {
    this.value.set(e.formData);
    if (this.afterChange) {
      this.afterChange(e);
    }
  };
  onSubmit = (e: IChangeEvent<T, any>) => {
    if (this.afterSubmit) {
      this.afterSubmit(e);
    }
  };
  afterSubmit: (e: IChangeEvent<T, any>) => void;
  afterChange: (e: IChangeEvent<T, any>) => void;

  setData(data: T) {
    this.value.set(data);
  }
  setKV(key, value) {
    _.set(this, key, value);
  }
  init(data: Partial<JSONSchemaState<T>>) {
    Object.assign(this, data);
  }

  reset({ force = false } = {}) {
    if (force) {
      this.value.value = this.value.default;
    } else {
      this.value.reset();
    }
  }

  constructor(args: Partial<JSONSchemaState<T>> = {}) {
    Object.assign(this, args);
    if (this.reactive) {
      //@ts-ignore
      makeObservable(this, {
        formData: computed
      });
      // makeAutoObservable(this, {
      //   formData: observable,
      //   onChange: action.bound,
      //   onSubmit: action.bound
      // });
    }
  }
}

export interface JSONSchemaValue {
  value?: any;
  default?: any;
  set: (value: any) => void;
  get: () => any;
  reset: () => any;
}

export class JSONValue<T> {
  value?: T = null as T;
  default?: T = null as T;

  get() {
    return this.value;
  }
  set(val) {
    console.log(val);
    const newVal = _.mergeWith(this.value, val, (objValue, srcValue) => {
      return srcValue || '';
    });
    this.value = toJS(newVal);
  }
  reset() {
    this.set(this.default);
  }
  constructor(args: Partial<JSONValue<T>> = {}) {
    if (!args.value && args.default) {
      args.value = args.default;
    }
    Object.assign(this, args);

    makeAutoObservable(this);
  }
}
