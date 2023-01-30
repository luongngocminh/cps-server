import events from '@/subscribers/events';
import { EventDispatcher } from 'event-dispatch';

export enum SYSTEM_STATUS {
  OK,
  ERROR,
  WARN,
}

const _SystemStore = {
  status: SYSTEM_STATUS.OK,
};

export const SystemStore = new Proxy(_SystemStore, {
  set(obj, prop: string, value: any) {
    const ed = new EventDispatcher();
    Reflect.set(obj, prop, value);
    ed.dispatch(events.system.onUpdateState, { obj, prop, value });

    return true;
  },
});
