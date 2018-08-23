const assert = require('assert');

const NodeMetaClass = require('../metaclass');
const BrowserMetaClass = (require('../browser_metaclass'), global.MetaClass);
delete require.cache[require.resolve('../browser_metaclass')];
const original_Function = Function;
global.Function = (...args) => {
  // Emulate no classes
  if (args[args.length - 1].includes('class MetaClass')) {
    throw SyntaxError('No classes emulation');
  }
  return original_Function(...args);
}
global.Function.prototype = original_Function.prototype;
const OldBrowserMetaClass = (require('../browser_metaclass'), global.MetaClass);
global.Function = original_Function;
assert.ok(!/^class/.test(OldBrowserMetaClass + ''), 'Could not import browser_metaclass while emulating no classes.');


const test = (MetaClass, name) => {
  'use strict';

  describe(name, () => {
    const Optional = new MetaClass('Optional', {
      constructor (value) {
        if (arguments.length > 0) {
          this.value = value;
        }
      },
      get value () {
        if (this.has_value()) {
          return this._value;
        }
        throw Error('No value in ' + this.constructor.name + '().');
      },
      set value (to) {
        this._value = to;
      },
      has_value () {
        return '_value' in this;
      },
      clear_value () {
        delete this._value;
      }
    });

    it('should set the name', () => {
      assert.strictEqual(Optional.name, 'Optional');
    });
    it('should set the length of the constructor', () => {
      assert.strictEqual(Optional.length, 1);
    });
    it('should create instances', () => {
      assert.ok(Optional instanceof MetaClass);
    });
    it('should create functions', () => {
      assert.ok(typeof Optional === 'function');
    });
    it('should not require classes to use `new`', () => {
      assert.ok(new Optional() instanceof Optional, 'new Cls() not an instanceof Cls. Actual: ' + (new Optional()).constructor.name);
      assert.ok(Optional() instanceof Optional, '(no new) Cls() not an instanceof Cls. Actual: ' + Optional().constructor.name);
      assert.strictEqual(Optional(1).value, 1);
      assert.strictEqual((new Optional()).has_value(), false);
    });
    it('should allow constructors to return different values', () => {
      const obj = {};
      const GetObj = new MetaClass('GetObj', {
        constructor () {
          return obj;
        }
      });
      assert.strictEqual(new GetObj(), obj);
    });
    it('should work for inherited prototypes', () => {
      let called = false;

      class Callee {
        constructor () {
          called = true;
        }

        c() {
          return 'c';
        }
      }

      const prototype = Object.create(Callee.prototype);
      prototype.a = 1;
      const Caller = new MetaClass('Caller', prototype);
      const called_obj = new Caller();
      assert.strictEqual(called_obj.a, 1);
      assert.strictEqual(called_obj.c(), 'c');
      assert.ok(called);
    });
    it('should work if the constructor is a class', () => {
      const Test = new MetaClass('Test', (class {
        constructor (a) {
          this.a = a;
        }

        get_a () {
          return this.a;
        }
      }).prototype);

      const test = new Test(1);
      assert.strictEqual(test.get_a(), 1);
    });
    describe('extending MetaClass', () => {
      class MakeOptionalWithDefault extends MetaClass {
        constructor (default_value) {
          const prototype = Object.create(Optional.prototype);
          prototype.constructor = function constructor (value) {
            Optional.call(this, arguments.length === 0 ? default_value : value);
          };
          super('MakeOptionalWithDefault(' + default_value + ')', prototype);
        }
      }

      it('should be extendable', () => {
        const zero_default = new MakeOptionalWithDefault(0);
        assert.strictEqual((new zero_default()).value, 0);
      });
      it('should have extendable instance', () => {
        class OptNumber extends new MakeOptionalWithDefault(0) {
          add (other) {
            return this.value + other.value;
          }
        }

        const base = new MakeOptionalWithDefault(0);

        function TraditionalSubclass (value) {
          base.apply(this, arguments);
        }

        TraditionalSubclass.prototype = Object.create(base.prototype);
        TraditionalSubclass.prototype.constructor = TraditionalSubclass;
        const four = new OptNumber(4);
        const zero = new TraditionalSubclass();
        assert.strictEqual(four.value, 4);
        assert.strictEqual(zero.value, 0);
        assert.ok(four instanceof OptNumber, 'four not an instance of OptNumber. Actual: ' + four.constructor.name);
        assert.ok(zero instanceof TraditionalSubclass, 'four not an instance of TraditionalSubclass. Actual: ' + zero.constructor.name);
        assert.strictEqual(four.add(zero), 4);
      });
    });
  });
};

test(NodeMetaClass, 'MetaClass');
test(BrowserMetaClass, 'MetaClass (browser with class)');
test(OldBrowserMetaClass, 'MetaClass (browser no class)');
