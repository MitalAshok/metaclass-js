const MetaClass = require('metaclass');

module.exports = class Singleton extends MetaClass {
  constructor(name = '<Singleton>', initialiser = Function.prototype) {
    let instance = undefined;
    super(name, {
      constructor() {
        if (instance !== undefined) {
          return instance;
        }
        const new_instance = Function.prototype.call(initialiser, this, this);
        if (Object(new_instance) !== new_instance) {
          instance = this;
        } else {
          instance = new_instance;
        }
        return this;
      }
    });
  }
};

// Example 1

const Singleton = require('.');

class Events extends new Singleton('Connection', state => {
  state._counter = 0;
  state._events = [];
}) {
  new_event(type, value) {
    const event = {
      id: this._counter++,
      type: type,
      value: value
    };
    this._events.push(event);
    return event;
  }
  get_event_by_id(id) {
    return this._events[id];
  }
  find_last_event(type) {
    for (let i = this._events.length; i-- > 0;) {
      if (this._events[i].type === type) {
        return this._events[i];
      }
    }
  }
}

// Example 2

const Data = new Singleton('Data', data => {
  let loaded_data = undefined;
  let error = null;
  data._onload = [];
  data.then = function then(callback) {
    if (data._onload === null) {
      callback(error, loaded_data);
    } else {
      data._onload.push(callback);
    }
  };
  const call_callbacks = (err, value) => {
    error = err;
    loaded_data = value;
    const callbacks = data._onload;
    delete data._onload;
    for (const callback of callbacks) {
      callback(error, loaded_data);
    }
  };
  fetch('/data.json')
    .then(r => r.json())
    .then(r => call_callbacks(null, r))
    .catch(err => call_callbacks(err, undefined));
});

// Somewhere later

const data = new Data();
data.then((err, data) => {
  if (err) {
    (new Events()).new_event('error', err);
    throw err;
  }
  /* Do stuff */
});
