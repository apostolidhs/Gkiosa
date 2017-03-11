(function () {

'use strict';

angular.module('gkiosa.app.components.gkiosaApi')

.factory('gkiosaApiUtilities', gkiosaApiUtilities);

function gkiosaApiUtilities($rootScope, $q, $state, $ngBootbox, toastr, gkiosaApi) {

  return {
    getStatistics,

    createEmptyInvoice,
    createEmptyReceipt,
    createEmptyProduct,
    createEmptyUser,

    deleteUser,
    deleteProduct,
    deleteInvoice,
    deleteReceipt
  };

  function getStatistics() {
    return $q.all([
      gkiosaApi.findAllUsers(),
      gkiosaApi.findAllReceipts(),
      gkiosaApi.findAllInvoices()
    ]).then(prmsResults => calculateStatistics(
      prmsResults[0].results,
      prmsResults[1].results,
      prmsResults[2].results
    ));
  }

  function calculateStatistics(allUsers, allReceipts, allInvoices) {
    return {
      getReceiptSummaries,
      getInvoiceSummaries,
      getCustomersFromAllUsers: genVectorFromAllUsers('CUSTOMERS'),
      getSuppliersFromAllUsers: genVectorFromAllUsers('SUPPLIERS'),
      getInvoiceHistorical,
      getReceiptHistorical,
      isEmpty: {
        users: _.isEmpty(allUsers),
        receipts: _.isEmpty(allReceipts),
        invoices: _.isEmpty(allInvoices),
        all: _.isEmpty(allUsers) || _.isEmpty(allReceipts) || _.isEmpty(allInvoices)
      }
    };

    function getInvoiceSummariesFromUser(userId, vector, dateRange) {
      const filteredInvoices = filterByDate(allInvoices, dateRange);
      const userInvoices = _.filter(filteredInvoices, invoice => invoice.userId === userId && (!vector || invoice.vector === vector));
      return _.isEmpty(userInvoices) ? undefined : getInvoiceSummaries(userInvoices, dateRange);
    }

    function getReceiptSummariesFromUser(userId, vector, dateRange) {
      const filteredReceipts = filterByDate(allReceipts, dateRange);
      const userReceipts = _.filter(filteredReceipts, receipt => receipt.userId === userId && (!vector || receipt.vector === vector));
      return  _.isEmpty(userReceipts) ? undefined : getReceiptSummaries(userReceipts, dateRange);
    }

    function getReceiptSummaries(receipts, dateRange) {
      const filteredReceipts = filterByDate(receipts || allReceipts, dateRange);
      const summaries = _.transform(
        filteredReceipts,
        (summaries, receipt) => {
          summaries[receipt.vector].bank += receipt.bank;
          summaries[receipt.vector].cash += receipt.cash;
          summaries[receipt.vector].check += receipt.check;
        },
        {
          SUPPLIERS: {
            bank: 0,
            cash: 0,
            check: 0
          },
          CUSTOMERS: {
            bank: 0,
            cash: 0,
            check: 0
          }
        }
      );
      summaries.BALANCE = {
        bank: summaries.CUSTOMERS.bank - summaries.SUPPLIERS.bank,
        cash: summaries.CUSTOMERS.cash - summaries.SUPPLIERS.cash,
        check: summaries.CUSTOMERS.check - summaries.SUPPLIERS.check
      }
      summaries.TOTAL = {
        SUPPLIERS: summaries.SUPPLIERS.bank + summaries.SUPPLIERS.cash + summaries.SUPPLIERS.check,
        CUSTOMERS: summaries.CUSTOMERS.bank + summaries.CUSTOMERS.cash + summaries.CUSTOMERS.check
      }
      summaries.TOTAL.BALANCE = summaries.TOTAL.CUSTOMERS - summaries.TOTAL.SUPPLIERS;
      return summaries;
    }

    function getInvoiceSummaries(invoices, dateRange) {
      const filteredInvoices = filterByDate(invoices || allInvoices, dateRange);
      const summaries = _.transform(
        filteredInvoices,
        (summaries, invoice) => summaries[invoice.vector] += getInvoiceProductsPrice(invoice),
        {
          SUPPLIERS: 0,
          CUSTOMERS: 0
        }
      );
      summaries.BALANCE = summaries.CUSTOMERS - summaries.SUPPLIERS;
      return summaries;
    }

    function getInvoiceProductsPrice(invoice) {
      return _.reduce(
        invoice.products,
        (sum, product) => sum + ((product.price + (product.price * (product.vat/100))) * product.quantity),
        0
      );
    }

    function genVectorFromAllUsers(vector) {
      return (dateRange) => _.transform(
          allUsers,
          (summaries, user) => {
            const invoices = getInvoiceSummariesFromUser(user._id, vector, dateRange);
            const receipts = getReceiptSummariesFromUser(user._id, vector, dateRange);
            if(!_.isEmpty(invoices) || !_.isEmpty(receipts)) {
              const rval = receipts ? receipts.TOTAL[vector] : 0;
              const ival = invoices ? invoices[vector] : 0;
              const total = rval + ival;
              summaries.push({ invoices, receipts, total, user });
            }
          },
          []
        );
    }

    function getInvoiceHistorical() {
      const historicals = _.transform(
        allInvoices,
        (summaries, invoice) => summaries[invoice.vector].push([invoice.date.getTime(), getInvoiceProductsPrice(invoice)]),
        {
          SUPPLIERS: [],
          CUSTOMERS: []
        }
      );
      _(historicals).each((vectorVal, vector) => historicals[vector] = _.sortBy(vectorVal, _.first));
      return historicals;
    }

    function getReceiptHistorical() {
      const historicals = _.transform(
        allReceipts,
        (summaries, receipt) => {
          summaries[receipt.vector].bank.push([receipt.date.getTime(), receipt.bank]);
          summaries[receipt.vector].cash.push([receipt.date.getTime(), receipt.cash]);
          summaries[receipt.vector].check.push([receipt.date.getTime(), receipt.check]);
        },
        {
          SUPPLIERS: {
            bank: [],
            cash: [],
            check: []
          },
          CUSTOMERS: {
            bank: [],
            cash: [],
            check: []
          }
        }
      );
      _(historicals).each((vectorVal, vector) =>
        _(vectorVal).each((kindVal, kind) => historicals[vector][kind] = _.sortBy(kindVal, _.first))
      );

      return historicals;
    }

    function filterByDate(items, dateRange) {
      return _.filter(items, item => {
        const itemDate = item.date.getTime();
        return itemDate >= dateRange[0] && itemDate <= dateRange[1];
      });
    }
  }

  function createEmptyInvoice(vector, uniqId) {
    gksAssert(uniqId > 0);
    return {
      uniqId,
      vector,
      products: [],
      date: new Date(),
      credit: false,
      userId: undefined,
      user: undefined,
      invoiceNum: undefined
    };
  }

  function createEmptyReceipt(vector, uniqId) {
    gksAssert(uniqId > 0);
    return {
      uniqId,
      vector,
      userId: undefined,
      user: undefined,
      date: new Date(),
      receiptNum: undefined,
      bank: 0,
      cash: 0,
      check: 0,
      commend: undefined
    };
  }

  function createEmptyProduct() {
    return {
      name: undefined,
      productId: undefined,
      vat: 0
    };
  }

  function createEmptyUser() {
    return {
      name: undefined,
      code: undefined,
      debt: 0,
      vat: undefined,
      taxAuthority: undefined,
      address: undefined,
      profession: undefined
    }
  }

  function deleteUser(user) {
    return gkiosaApi.getUserDependencies(user._id).then(dependencies => {
      let prms;
      if (dependencies) {
        prms = $ngBootbox.confirm(getWarningMsg(dependencies));
      } else {
        prms = $q.when(true);
      }
      prms.then(() => gkiosaApi.deleteUser(user._id)
                        .then(() => toastr.success(`Ο χρήστης ${user.name} διαγράφηκε`))
      );
    });

    function getWarningMsg(dependencies) {
      let invMsg = '';
      let recMsg = '';
      if (!_.isEmpty(dependencies.invoices)) {
        invMsg += 'Τα τιμολόγια ' + dependencies.invoices.map(inv => {
          const invUrl = $state.href('invoices.invoice', {invoiceId: inv._id, vector: inv.vector, name: inv.invoiceNum});
          return `<a href="${invUrl}">${inv.invoiceNum}</a>`;
        }).join(', ');
      }
      if (!_.isEmpty(dependencies.receipts)) {
        recMsg += 'Oι αποδείξεις ' + dependencies.receipts.map(rec => {
          const recUrl = $state.href('receipts.receipt', {receiptId: rec._id, vector: rec.vector, name: rec.receiptNum});
          return `<a href="${recUrl}">${rec.receiptNum}</a>`;
        }).join(', ');
      }
      const userUrl = $state.href('users.user', {userId: user._id, vector: user.vector, name: user.name});
      const userHref = `<a href="${userUrl}">${user.name}</a>`;
      const userMsg = `Eξαρτώνται απο τον ${userHref}.`;

      const warnMsg =  'Ειστε σίγουροι ότι θέλετε να τον διαγράψεται?';

      const msg = `
        <h4>${invMsg}</h4>
        <h4>${recMsg}</h4>
        <h4>${userMsg}</h4>
        <p class="lead">${warnMsg}</p>`;
      return msg;
    }
  }

  function deleteProduct(product) {
    return $ngBootbox.confirm(`<h3>Θέλετε σίγουρα να διαγράψετε το προιόν ${product.name}?</h3>`)
      .then(() => gkiosaApi.deleteProduct(product._id))
      .then(() => toastr.success(`Το προιόν ${product.name} διαγράφηκε`));
  }

  function deleteInvoice(invoice) {
    return $ngBootbox.confirm(`<h3>Θέλετε σίγουρα να διαγράψετε το τιμολόγιο ${invoice.invoiceNum}?</h3>`)
      .then(() => gkiosaApi.deleteInvoice(invoice._id))
      .then(() => toastr.success(`Το τιμολόγιο ${invoice.invoiceNum} διαγράφηκε`));
  }

  function deleteReceipt(receipt) {
    return $ngBootbox.confirm(`<h3>Θέλετε σίγουρα να διαγράψετε την απόδειξη ${receipt.receiptNum}?</h3>`)
      .then(() => gkiosaApi.deleteReceipt(receipt._id))
      .then(() => toastr.success(`Η απόδειξη ${receipt.receiptNum} διαγράφηκε`));
  }

}

})();
