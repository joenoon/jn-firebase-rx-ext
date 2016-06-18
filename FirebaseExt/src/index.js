'use strict';

import Firebase from 'firebase';
import Rx from '../../RxExt/src/index';

// there can only be one authHandler
var authHandler;

Firebase.prototype.__proto__.onAuthSignal = function () {
  var that = this;
  return Rx.Observable.create(function (subscriber) {
    var dispose = function () {
      if (authHandler) {
        that.offAuth(authHandler);
        authHandler = null;
      }
    };
    dispose();
    authHandler = function (authData) {
      subscriber.onNext(authData);
    };
    that.onAuth(authHandler);
    return function () {
      dispose();
    };
  });
};

// establish a value listener on the ref before starting the transaction and
// hold it until the transaction completes, to ensure the transaction's
// updateFunction is first called with the current value, and not always null.
// in many cases null would leave no choice but to abort.
Firebase.prototype.__proto__.transactionSignal = function (fn) {
  var that = this;
  return Rx.Observable.create(function (subscriber) {
    var needsRun = true;
    var refDis = that.snapSignal()
    .subscribe(
      function (v) {
        if (needsRun) {
          needsRun = false;
          that.transaction(fn, function (err, committed, snap) {
            if (err) {
              console.log('FIREBASE ERROR:', err, 'transactionSignal');
              subscriber.onError(err);
            } else {
              subscriber.onNext([committed, snap]);
              subscriber.onCompleted();
            }
          });
        }
      },
      function (err) {
        console.log('FIREBASE ERROR:', err, 'transactionSignal');
        subscriber.onError(err);
      },
      function () {
      }
    );
    return function () {
      refDis.dispose();
    };
  });
};

Firebase.prototype.__proto__.pushSignal = function (data) {
  var that = this;
  return Rx.Observable.create(function (subscriber) {
    that.push(data, function (err) {
      if (err) {
        console.log('FIREBASE ERROR:', err, 'pushSignal', data);
        subscriber.onError(err);
      } else {
        subscriber.onNext(true);
        subscriber.onCompleted();
      }
    });
  });
};

Firebase.prototype.__proto__.updateSignal = function (data) {
  var that = this;
  return Rx.Observable.create(function (subscriber) {
    that.update(data, function (err) {
      if (err) {
        console.log('FIREBASE ERROR:', err, 'updateSignal', JSON.stringify(data));
        subscriber.onError(err);
      } else {
        subscriber.onNext(true);
        subscriber.onCompleted();
      }
    });
  });
};

Firebase.prototype.__proto__.removeSignal = function () {
  var that = this;
  return Rx.Observable.create(function (subscriber) {
    that.remove(function (err) {
      if (err) {
        console.log('FIREBASE ERROR:', err, 'removeSignal');
        subscriber.onError(err);
      } else {
        subscriber.onNext(true);
        subscriber.onCompleted();
      }
    });
  });
};

Firebase.prototype.__proto__.snapSignal = function () {
  var that = this;
  return Rx.Observable.create(function (subscriber) {
    var handle = that.on('value', function (snap) {
      subscriber.onNext(snap);
    }, function (err) {
      console.log('FIREBASE ERROR:', err, 'snapSignal');
      subscriber.onError(err);
    });
    return function () {
      that.off('value', handle);
    };
  });
};

Firebase.prototype.__proto__.valueSignal = function () {
  return this.snapSignal().map((snap) => snap.val());
};

Firebase.prototype.__proto__.arrayOfSnapsSignal = function () {
  return this.snapSignal()
  .map((snap) => {
    var results = [];
    if (snap) {
      snap.forEach((childSnap) => {
        results.push(childSnap);
      });
    }
    return results;
  });
};

Firebase.prototype.__proto__.arrayOfValuesSignal = function () {
  return this.snapSignal()
  .map((snap) => {
    var results = [];
    if (snap) {
      snap.forEach((childSnap) => {
        results.push(childSnap.val());
      });
    }
    return results;
  });
};

Firebase.prototype.__proto__.childAddedSignal = function () {
  var that = this;
  return Rx.Observable.create(function (subscriber) {
    var handle = that.on('child_added', function (snap, prev) {
      subscriber.onNext([snap, prev]);
    }, function (err) {
      console.log('FIREBASE ERROR:', err, 'childAddedSignal');
      subscriber.onError(err);
    });
    return function () {
      that.off('value', handle);
    };
  });
};

Firebase.prototype.__proto__.toRootUpdateJS = function (data) {
  var that = this;
  var out = {};
  Object.keys(data).forEach(function (key) {
    out[that.child(key).path.toString()] = data[key];
  });
  return out;
};

Firebase.transformSnapsSignal = function (snap, transformFn) {
  var refs = [];
  snap.forEach((childSnap) => {
    let ref = transformFn(childSnap);
    if (ref) {
      refs.push(ref);
    }
  });
  return Firebase.batchSnapsSignal(refs);
};

Firebase.batchSnapsSignal = function (refs) {
  if (refs.length == 0) {
    return Rx.Observable.return([]);
  } else {
    var signals = [];
    for (var i = 0; i < refs.length; i++) {
      var ref = refs[i];
      signals.push(ref.snapSignal().take(1));
    }
    return Rx.Observable.combineLatest(...signals).take(1);
  }
};

export default Firebase;
