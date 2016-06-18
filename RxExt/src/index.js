'use strict';

import Rx from 'rx-lite';

// begins observing immediately and acts as a ReplaySubject(1)
Rx.Observable.prototype.replayLastUntil = function (untilSig) {
  var sig = this.replay(null, 1);
  var conn = sig.connect();
  sig.replayLastUntilConnection = conn;
  untilSig.subscribe(
    function (x) { conn.dispose(); },
    function (err) { conn.dispose(); },
    function () { conn.dispose(); }
  );
  return sig;
};

Rx.Observable.prototype.logAll = function (str) {
  return this.tap(
    function (x) { console.log('logAll', str, 'NEXT:', x); },
    function (err) { console.log('logAll', str, 'ERR:', err); },
    function () { console.log('logAll', str, 'COMPLETE'); }
  );
};

Rx.Observable.prototype.logSnap = function (str) {
  return this.tap(
    function (x) {
      if (!x) {
        console.log('logSnap', str, 'null');
      } else if (Array.isArray(x)) {
        for (var i=0; i < x.length; i++) {
          let y = x[i];
          console.log('logSnap', str, 'url:', y.ref().toString(), 'key:', y.key(), 'val:', y.val());
        }
      } else {
        console.log('logSnap', str, 'url:', x.ref().toString(), 'key:', x.key(), 'val:', x.val());
      }
    }
  );
};

Rx.Observable.reduceHash = function (hash) {
  var output = {};
  var keys = [];
  var vals = [];
  Object.keys(hash).forEach(function (key) {
    let val = hash[key];
    if (val instanceof Rx.Observable) {
      keys.push(key);
      vals.push(val);
    } else {
      output[key] = val;
    }
  });
  // console.log('reduceHash', 'output', output, 'hash', hash, 'keys', keys, 'vals', vals);
  vals.push(Rx.Observable.return(true));
  return Rx.Observable.combineLatest(vals)
  .map((results) => {
    for (let i = 0; i < keys.length; i++) {
      output[keys[i]] = results[i];
    }
    return output;
  });
};

Rx.Observable.prototype.reduceHash = function (fn) {
  return this.flatMapLatest((hash) => {
    return Rx.Observable.reduceHash(fn(hash));
  });
};

export default Rx;
