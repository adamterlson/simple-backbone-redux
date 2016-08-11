const noop = arg => arg;

/**
 * The special event name that is emitted from the BB side into the store as a
 * "dispatch".
 */
export const BB_EVENT_NAME = '__HELLO_ENHANCER__';

/**
 * Take key/value pairs where the values are backbone entities
 * and export an API consistent with that of a singular backbone
 * entity.  All events are triggered on all entities in the hash.
 */
export const bbCombineEntities = (hash) => {
    // Check if it's already got the BB API, return it.
    if (hash.on && hash.trigger && hash.toJSON) {
        return hash;
    }
    const bbThings = Object.keys(hash).map(name => hash[name]);

    const on = (...args) =>
        bbThings.forEach(thing => thing.on(...args));
    const trigger = (...args) =>
        bbThings.forEach(thing => thing.trigger(...args));
    const toJSON = () => JSON.parse(JSON.stringify(hash));

    return { on, trigger, toJSON };
};

/**
 * Replace the dispatch function of a redux store to also trigger the
 * action.type as an event with a payload of action.payload.
 */
export const bbStoreEnhancer = (bb) => (storeCreator) => (...args) => {
    const store = storeCreator(...args);
    const dispatch = (action) => {
        bb.trigger(action.type, action.payload);
        store.dispatch(action);
    };

    return {
        ...store,
        dispatch,
    };
};

/**
 * Returns a "reducer" that returns a BB entity's present state
 */
export const bbReducer = ({ toJSON }) => () => toJSON();

/**
 * Used only when Redux is unavailable. Creates a redux-like store, implementing
 * the same API methods.
 */
export const createStore = (reducer, __, enhancer) => {
    if (enhancer) {
        return enhancer(createStore)(reducer);
    }

    let listeners = [];
    const notifyAllListeners = () => listeners.forEach(listener => listener());
    const getState = () => reducer();
    const dispatch = () => notifyAllListeners();
    const subscribe = (listener) => {
        listeners.push(listener);
        return () => {
            listeners = listeners.filter(l => l !== listener);
            return listeners;
        };
    };

    dispatch();

    return {
        _listeners: listeners,
        getState,
        dispatch,
        subscribe,
    };
};

/**
 * Convenience method to quickly create our store, optionally using the redux
 * createStore() method or our own defined above.  Automatically combines
 * entities (which is a noop if single entity is provided), creates the store
 * enhancer for the entities, and subscribes to the wiring event.
 */
export const bbCreateStore = (storeCreator = createStore) => (bbEntities, enhancer = noop) => {
    const bb = bbCombineEntities(bbEntities);
    const composedEnhancers = (...args) => bbStoreEnhancer(bb)(enhancer(...args));
    const store = storeCreator(bbReducer(bb), {}, composedEnhancers);

    bb.on(BB_EVENT_NAME, (action) => store.dispatch(action, { silent: true }));

    return store;
};

/**
 * Dispatch-like usage, but triggers a special event behind the scenes which is
 * listened to by the store-enhancer.  This is the communication method from
 * the backbone world into the react world.
 */
export const bbDispatch = (bb, type, payload) =>
    bb.trigger(BB_EVENT_NAME, { type, payload });
