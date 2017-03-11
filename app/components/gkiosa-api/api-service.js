(function () {

'use strict';

angular.module('gkiosa.app.components.gkiosaApi')

.factory('gkiosaApi', gkiosaApi);

/*
  @TODO: in restoreAllData we only check the date field for parse dates.
  We should check all the fields in depth.
*/

function gkiosaApi($q, toastr, gkiosaContext, gkiosaConfig) {

  const tableNames = ['users', 'products', 'receipts', 'invoices', 'appinfo'];
  const Datastore = getDBDriver();
  const db = createDbs();

  // insertFakeDocuments();

  const api = {
    getUserDependencies,
    getMixedItems,
    getAllData,
    restoreAllData,
    deleteAllData,

    findUser: createSimpleCrudFind('users'),
    findAllUsers: createSimpleCrudFindAll('users'),
    createUser: createSimpleCrudCreate('users'),
    updateUser,
    deleteUser: createSimpleCrudDelete('users'),

    // findProduct: createSimpleCrudFind('products'),
    // findAllProducts: createSimpleCrudFindAll('products'),
    findProduct: findProduct,
    findAllProducts: findAllProducts,
    createProduct: createSimpleCrudCreate('products'),
    updateProduct: createSimpleCrudUpdate('products'),
    deleteProduct: createSimpleCrudDelete('products'),

    findReceipt: createSimpleCrudFind('receipts'),
    findAllReceipts,
    createReceipt: createCrudCreateWithUserId('receipts'),
    updateReceipt: createCrudUpdateWithUserId('receipts'),
    deleteReceipt: createSimpleCrudDelete('receipts'),

    // findInvoice: createSimpleCrudFind('invoices'),
    findInvoice,
    findAllInvoices,
    createInvoice: createCrudCreateWithUserId('invoices'),
    updateInvoice: createCrudUpdateWithUserId('invoices'),
    deleteInvoice: createSimpleCrudDelete('invoices'),

    findAppInfo,
    createAppInfo: createSimpleCrudCreate('appinfo'),
    updateAppInfo: createSimpleCrudUpdate('appinfo'),
    deleteAppInfo: createSimpleCrudDelete('appinfo'),
  };

  return api;

  function getDBDriver() {
    if (gkiosaContext.isDesktop()) {
      return require('nedb');
    } else if (gkiosaContext.isBrowser()) {
      return Nedb;
    } else {
      throw new Error('Cannot find database');
    }
  }

  function createDbs() {
    const getter = (db, dbName) => db[dbName] = new Datastore({ filename: `db/${dbName}.db`, autoload: true });
    return _.transform(tableNames, getter, {});
  }

  function deferredJob(job) {
    const deferred = $q.defer();
    job(deferred);
    return deferred.promise;
  }

  function respHandle(deferred, successCb) {
    return (err, resp) => {
      if (err) {
        const subject = encodeURI('Gkiosa unexpected error');
        let body = err.stack || JSON.stringify(err);
        body = _.isEmpty(body) ? err + '' : body;
        const mailto = `mailto:${gkiosaConfig.technicalContact}?Subject=${subject}&Body=${encodeURI(body)}`;
        const msg = `
          <span>
            Επικοινωνήστε με τον τεχνικό υπεύθυνο
            <a href="${mailto}" target="_blank" class="gks-toastr-link">${gkiosaConfig.technicalName}</a>
          </span>
          <br>
          <div class="gks-toastr-code"><code>${body}</code></div>
        `;
        const title = '<h4>Προέκυψε πρόβλημα κατα την επικοινωνία με την βάση</h4>';
        const toastrOpts = {
          timeOut: 0,
          closeButton: false,
          extendedTimeOut: 0,
          tapToDismiss: false
        };
        toastr.error(msg, title, toastrOpts);
        return  deferred.reject(err);
      } else {
        return deferred.resolve(successCb ? successCb(resp) : resp);
      }
    }
  }

  function getAllData() {
    const findAllPrms = _.map(tableNames, dbName => createSimpleCrudFindAll(dbName)());
    const getter = (all, resp, idx) => all[tableNames[idx]] = resp.results;
    return $q.all(findAllPrms)
      .then(results => _.transform(results, getter, {}));
  }

  function restoreAllData(data) {
    _.each(data, (records, dbName) => {
      if(tableNames.indexOf(dbName) === -1) {
        throw new Error('incompatible data');
      }
      _.each(records, r => {
        const date = new Date(Date.parse(r.date));
        if (r.date && date.toISOString() === r.date) {
          r.date = date;
        }
      });
    });
    return deleteAllData().then(() => {
      const createAllPrms = _.map(data, (records, dbName) => createSimpleCrudCreate(dbName)(records));
      return $q.all(createAllPrms);
    });
  }

  function deleteAllData() {
    const deleteAllPrms = _.map(tableNames, dbName => createSimpleCrudDelete(dbName)());
    return $q.all(deleteAllPrms);
  }

  function createSimpleCrudFind(dbName) {
    return (id) => deferredJob(deferred => db[dbName].find({ _id: id }, respHandle(deferred, users => _.first(users))));
  }

  function createSimpleCrudFindAll(dbName) {
    return (find, pagination, sort) => {
      return $q.all([
        deferredJob(countDeferred => db[dbName].count(find && find.vector ? {vector: find.vector} : {}, respHandle(countDeferred))),
        deferredJob(findDeferred => {
          const cursor = db[dbName].find(find || {});
          if (_.isObject(sort)) {
            cursor.sort(sort);
          }
          if (_.isObject(pagination)) {
            cursor.skip((pagination.page - 1) * pagination.count);
            cursor.limit(pagination.count);
          }
          cursor.exec(respHandle(findDeferred));
        })
      ])
      .then(results => _.identity({
        total: results[0],
        results: results[1]
      }));
    }
  }

  function createSimpleCrudCreate(dbName) {
    return (record) => deferredJob(deferred =>
        db[dbName].insert(sanitizeDBRecord(record), respHandle(deferred, record => record)));
  }

  function createSimpleCrudUpdate(dbName) {
    return (id, record) => deferredJob(deferred =>
        db[dbName].update({ _id: id }, sanitizeDBRecord(record), {}, respHandle(deferred, record => record)));
  }

  function createSimpleCrudDelete(dbName) {
    return (id) => deferredJob(deferred => {
      const q = id ? { _id: id } : {};
      const opts = id ? {} : { multi: true };
      db[dbName].remove(q, opts, respHandle(deferred, numRemoved => numRemoved));
    });
  }

  function updateUser(user) {
    const userId = user._id;
    return deferredJob(deferred => db['invoices'].update({ userId }, { user }, {}, respHandle(deferred, record => record)))
      .then(deferredJob(deferred => db['receipts'].update({ userId }, { user }, {}, respHandle(deferred, record => record))))
      .then(createSimpleCrudUpdate('users')(userId, user))
  }

  function addMetainfoToProduct(product) {
    product.price = product.price || 0;
    product.quantity = product.quantity || 0;
    // function instend of arrow function for inheritance
    product.getPrice = function() { return math.do(`${this.price} * ${this.quantity}`); };
    product.getVatPrice = function() { return math.do(`${this.price} * ${this.quantity} * ((${this.vat} / 100) + 1)`); };
    product.getVat = function() { return math.do(`${this.getVatPrice()} - ${this.getPrice()}`); };
  }

  function addMetainfoToInvoice(invoice) {
    _.each(invoice.products, p => addMetainfoToProduct(p));
    // function instend of arrow function for inheritance
    invoice.getTotalPrice = function() { return _.reduce(this.products, (sum, p) => math.do(`${sum} + ${p.getPrice()}`), 0); };
    invoice.getTotalVat = function() { return _.reduce(this.products, (sum, p) => math.do(`${sum} + ${p.getVat()}`), 0); };
    invoice.getTotalVatPrice = function() { return _.reduce(this.products, (sum, p) => math.do(`${sum} + ${p.getVatPrice()}`), 0); };
    return invoice;
  }

  function findInvoice(id) {
    return createSimpleCrudFind('invoices')(id)
      .then(i => addMetainfoToInvoice(i));
  }

  function findAllInvoices(find, pagination, sort) {
    return createSimpleCrudFindAll('invoices')(find, pagination, sort)
      .then(resp => {
        _.each(resp.results, i => addMetainfoToInvoice(i));
        return resp;
      });
  }

  function findProduct(id) {
    return createSimpleCrudFind('products')(id)
      .then(p => addMetainfoToProduct(p));
  }

  function findAllProducts(find, pagination, sort) {
    return createSimpleCrudFindAll('products')(find, pagination, sort)
      .then(resp => {
        _.each(resp.results, p => addMetainfoToProduct(p));
        return resp;
      });
  }

  function findAllReceipts(find, pagination, sort) {
    return createSimpleCrudFindAll('receipts')(find, pagination, sort)
      .then(resp => {
        _.each(resp.results, receipt => {
          receipt.getTotalPrice = () => math.do(`${receipt.bank} + ${receipt.cash} + ${receipt.check}`);
          receipt.getTotalVatPrice = receipt.getTotalPrice;
        });
        return resp;
      });
  }

  function findAppInfo() {
    return createSimpleCrudFindAll('appinfo')()
      .then(appInfoRes => {
        const appInfo = _.get(appInfoRes, 'results[0]');
        if (appInfo) {
          appInfo.increaseInvoiceCustomers = () => {
            ++appInfo.invoiceCustomersId;
            return api.updateAppInfo(appInfo._id, appInfo);
          };
          appInfo.increaseInvoiceSuppliers = () => {
            ++appInfo.invoiceSuppliersId;
            return api.updateAppInfo(appInfo._id, appInfo);
          };
          appInfo.increaseReceiptCustomers = () => {
            ++appInfo.receiptCustomersId;
            return api.updateAppInfo(appInfo._id, appInfo);
          };
          appInfo.increaseReceiptSuppliers = () => {
            ++appInfo.receiptSuppliersId;
            return api.updateAppInfo(appInfo._id, appInfo);
          };
        }
        return appInfo;
      });
  }

  function getMixedItems(userId, fromDate, toDate) {
    const find = {
      'user._id': userId,
      'date': {
        '$lte': toDate
      }
    };
    return $q.all([
      findAllInvoices(find),
      findAllReceipts(find)
    ])
    .then(results => {
      const invoices = results[0].results;
      const receipts = results[1].results;

      if (_.isEmpty(invoices) && _.isEmpty(receipts)) {
        return;
      }

      const mixed = _.sortBy((invoices || []).concat(receipts || []), 'date');
      const mixedItems = [];
      let prevItem = {
        progressive: {
          charge: 0,
          credit: 0,
          total: 0
        }
      };
      _.each(mixed, item => {
        const progressive = {};
        item.isInvoice = _.has(item, 'products');

        const addOnCharge = item.vector === 'CUSTOMERS';
        // const addOnCharge = item.vector === 'CUSTOMERS' && item.isInvoice
        //           || item.vector === 'SUPPLIERS' && !item.isInvoice;

        item.ammount = {
          charge: addOnCharge ? item.getTotalVatPrice() : 0,
          credit: !addOnCharge ? item.getTotalVatPrice() : 0
        };

        var charge = math.do(`${item.ammount.charge} + ${prevItem.progressive.charge}`);
        var credit = math.do(`${item.ammount.credit} + ${prevItem.progressive.credit}`);
        item.progressive = {
          charge,
          credit,
          total: math.do(`${charge} - ${credit}`)
        };

        // if (item.isInvoice) {
        //   item.progressive = {
        //     charge: math.do(`${item.ammount.charge} + ${prevItem.progressive.charge}`),
        //     credit: math.do(`${item.ammount.credit} + ${prevItem.progressive.credit}`),
        //     total: math.do(`${prevItem.progressive.credit} - ${Math.abs(prevItem.progressive.charge)}`)
        //   };
        // } else {
        //   item.progressive = {
        //     charge: math.do(`${prevItem.progressive.charge} - ${item.ammount.charge}`),
        //     credit: math.do(`${prevItem.progressive.credit} - ${item.ammount.credit}`),
        //     total: math.do(`${prevItem.progressive.credit} - ${Math.abs(prevItem.progressive.charge)}`)
        //   };
        // }

        prevItem = item;

        if (item.date.getTime() >= fromDate.getTime()) {
          mixedItems.push(createMixedItem(item));
        }
      });

      return mixedItems;
    });

    function createMixedItem(item) {
      let type;
      let name;
      if (item.isInvoice) {
        type = {
          id: 'invoice',
          name: 'τιμολόγιο'
        };
        name = item.invoiceNum;
      } else {
        type = {
          id: 'receipt',
          name: 'απόδειξη'
        };
        name = item.receiptNum;
      }
      return {
        type,
        name,
        uniqId: item.uniqId,
        date: item.date,
        getTotalVatPrice: item.getTotalVatPrice,
        progressive: item.progressive,
        ammount: item.ammount,
        raw: item
      }
    }
  }

  function getUserDependencies(userId) {
    return $q.all([
      findAllInvoices({ userId }),
      findAllReceipts({ userId })
    ])
    .then(results => {
      if (_.isEmpty(results[0].results) && _.isEmpty(results[1].results)) {
        return;
      }
      return {
        invoices: results[0].results,
        receipts: results[1].results
      };
    });
  }

  function createCrudCreateWithUserId(dbName) {
    return (record) => populateItems([record], 'user', 'userId', 'users')
      .then(results => _.first(results))
      .then(record => createSimpleCrudCreate(dbName)(record));
  }

  function createCrudUpdateWithUserId(dbName) {
    return (id, record) => populateItems([record], 'user', 'userId', 'users')
      .then(results => _.first(results))
      .then(record => createSimpleCrudUpdate(dbName)(id, record));
  }

  function populateItems(itemsWithUserId, targetKey, destinationKey, populatedDbName) {
    const query = _.chain(itemsWithUserId)
      .uniqBy(itemWithUserId => itemWithUserId[destinationKey])
      .map(itemWithUserId => _.identity({ _id: itemWithUserId[destinationKey]}))
      .value();

    return createSimpleCrudFindAll(populatedDbName)({ $or: query })
      .then(populatedItems => {
        const populatedItemsById = _.groupBy(populatedItems.results, '_id');
        _.each(
          itemsWithUserId,
          itemWithUserId => itemWithUserId[targetKey] = populatedItemsById[itemWithUserId[destinationKey]][0]
        );
        return itemsWithUserId;
      });
  }

  function sanitizeDBRecord(mainRecord) {

    return sanitizeDBRecordCollection(mainRecord);

    function sanitizeDBRecordCollection(record) {
      if(_.isArray(record)) {
        return sanitizeDBRecordArray(record);
      } else if(_.isObject(record) && !_.isDate(record)) {
        return sanitizeDBRecordObject(record);
      } else {
        return record;
      }
    }

    function sanitizeDBRecordArray(record) {
      return _.transform(record, (sanRec, rec) => sanRec.push(sanitizeDBRecordCollection(rec)), []);
    }

    function sanitizeDBRecordObject(record) {
      return _.transform(record, (sanRec, rec, recKey) => {
        if (!((_.isFunction(rec) && !_.isDate(rec)) || recKey === '$$hashKey')) {
          sanRec[recKey] = sanitizeDBRecordCollection(rec);
        }
      }, {});
    }

  }

  function insertFakeDocuments() {
    const users = _.range(100).map(idx => {
      return {
        name: `name${idx}`,
        code: `code${idx}`,
        debt: 100*idx,
        vat: `vat${idx}`,
        taxAuthority: `taxAuthority${idx}`,
        address: `address${idx}`,
        profession: `profession${idx}`,
        vector: idx%2===0?'SUPPLIERS': 'CUSTOMERS'
      };
    });
    const promiseOfUsers = createSimpleCrudCreate('users')(users);
    promiseOfUsers.then(users => {
      _.range(300).forEach(idx => {
        const receipt =  {
          date: new Date(_.now() - (1000 * 60 * 60 * 24 * ((idx + 1) % 20))),
          uniqId: idx + 1,
          receiptNum: `rec${idx*100}`,
          commend: `commend${idx}`,
          bank: idx%7===0 ? 0 : idx*100,
          cash: idx%13===0 ? 0 : idx*100,
          check: idx%17===0 ?  0: idx*100,
          userId: users[idx % 100]._id,
          vector: idx % 2 === 0 ? 'SUPPLIERS': 'CUSTOMERS'
        };
        createCrudCreateWithUserId('receipts')(receipt);
      });

    });

    const products = _.range(100).map(idx => {
      return {
        productId: `name${idx}`,
        name: `code${idx}`,
        vat: 22,
        vector: idx%2===0?'SUPPLIERS': 'CUSTOMERS'
      };
    });
    const promiseOfProducts = createSimpleCrudCreate('products')(products);

    $q.all([promiseOfUsers, promiseOfProducts])
      .then(results => {
        const users = results[0];
        const products = results[1];
        _.range(300).forEach(idx => {
          const invoicesProducts = [
            _.assignIn({
              price: 200*idx,
              quantity: 4+idx
            }, products[0]),
            _.assignIn({
              price: 300*idx,
              quantity: 5+idx
            }, products[1]),
            _.assignIn({
              price: 400*idx,
              quantity: 6+idx
            }, products[3]),
            _.assignIn({
              price: 600*idx,
              quantity: 7+idx
            }, products[4])
          ];
          const invoice =  {
            products: invoicesProducts,
            uniqId: idx + 1,
            date: new Date(_.now() - (1000 * 60 * 60 * 24 * ((idx + 1) % 20))),
            userId: users[idx % 100]._id,
            credit: idx%3===0,
            invoiceNum: `inv${idx*100}`,
            vector: idx%2===0?'SUPPLIERS': 'CUSTOMERS'
          };
          createCrudCreateWithUserId('invoices')(invoice);
        });
      });
  }
}

})();
