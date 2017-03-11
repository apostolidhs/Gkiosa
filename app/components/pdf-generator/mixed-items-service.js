(function () {

'use strict';

angular.module('gkiosa.app.components.pdfGenerator')

.factory('gkiosaPdfGeneratorMixedItems', gkiosaPdfGeneratorMixedItems);

function gkiosaPdfGeneratorMixedItems($filter, gkiosaPdfGenerator) {
  const gksDate = $filter('gksDate');
  const gksEuro = $filter('gksEuro');

  return gkiosaPdfGenerator.generatePdfMethods(generateDD);

  function generateDD(data) {
    const {user, mixedItems, dateRange} = data;

    const header = createHeader(dateRange);
    const userInfo = createUserInfo(user);
    const contentTable = createContent(mixedItems);
    const contentLayout = createContentLayout();
    const styles = getStyles();

    const dd = {
      content: [
        header,
        userInfo,
        {
          table: contentTable,
          layout: contentLayout
        }
      ],
      styles
    };

    return dd;
  }

  function getStyles() {
    return {
      useDetail: {
        bold: true
      },
      tableTitle: {
        bold: true
      },
      tableHeader: {
        bold: true,
        fontSize: 13,
        color: 'black'
      },
      mixedItem: {
        fontSize: 10,
      },
      products: {
        color: '#444',
        fontSize: 9,
      }
    };
  }

  function createHeader(dateRange) {
    const fromDateStr = gksDate(dateRange[0]);
    const toDateStr = gksDate(dateRange[1]);
    const nowStr = gksDate(new Date());
    return {
      columns: [
        {
          text: 'ΤΣΙΟΛΚΑΣ',
          width: 160
        },
        {
          text: `Περίοδος ${fromDateStr} - ${toDateStr}`,
          width: 300
        },
        {
          text: nowStr,
          width: 100
        }
      ]
    };
  }

  function createUserInfo(user) {
    const info = _.transform([
      ['Κωδικός', user.code],
      ['Επάγγελμα', user.profession],
      ['Τηλέφωνο', user.phone || '-'],
      ['Επωνημία', user.name],
      ['Δ.Ο.Υ', user.taxAuthority],
      ['Διεύθυνση', user.address],
      ['Α.Φ.Μ.', user.vat],
      ['', ''],
      ['', '']
    ], (body, info, idx) => {
      if (idx % 3 === 0) {
        body.push([]);
      }
      const lastBody = _.last(body);
      lastBody.push(info[0]);
      lastBody.push({ text: _.toString(info[1]), style: 'useDetail'});
    }, []);

    return {
      table: {
        headerRows: 1,
        widths: [70, 85, 70, 85, 70, 85],
        body: info
      },
      margin: [0, 8],
      layout: createUserInfoLayout()
    };
  }

  function createInvoice(item) {
    const invoice = [
      gksDate(item.date),
      `ΤΙΜΟΛΟΓΙΟ - ${item.name}`,
      gksEuro(item.ammount.charge),
      gksEuro(item.ammount.credit),
      gksEuro(item.progressive.charge),
      gksEuro(item.progressive.credit),
      gksEuro(item.progressive.total)
    ].map(t => ({ text: t, style: 'mixedItem'}));

    const header = [
      'Κωδικός',
      'Περιγραφή',
      'Ποσότητα',
      'Τιμή Μοναδας',
      'Καθαρή Αξία',
      'Αξία ΦΠΑ',
      'Σύνολο'
    ].map(t => ({ text: t, style: 'products'}));

    const products = _.map(item.raw.products, p => [
      p.productId,
      p.name,
      p.quantity,
      gksEuro(p.price),
      gksEuro(p.getPrice()),
      gksEuro(p.getVat()),
      gksEuro(p.getVatPrice())
    ].map(t => ({ text: _.toString(t), style: 'products'})));

    return [invoice, header].concat(products);
  }

  function createReceipt(item) {
    return [
      gksDate(item.date),
      `ΑΠΟΔΕΙΞΗ - ${item.name}`,
      gksEuro(item.ammount.charge),
      gksEuro(item.ammount.credit),
      gksEuro(item.progressive.charge),
      gksEuro(item.progressive.credit),
      gksEuro(item.progressive.total)
    ].map(t => ({ text: t, style: 'mixedItem'}));
  }

  function createContent(midexItems) {
    let content = [];
    content.push([
      { text: 'Κινήσεις', style: 'tableTitle', colSpan: 4, alignment: 'center'}, {}, {}, {},
      { text: 'Προοδευτικά', style: 'tableTitle', colSpan: 3, alignment: 'center'}, {}, {}
    ]);

    content.push([
      { text: 'Ημερομηνία', style: 'tableHeader'},
      { text: 'Παραστατικό', style: 'tableHeader'},
      { text: 'Χρέωση', style: 'tableHeader'},
      { text: 'Πίστωση', style: 'tableHeader'},
      { text: 'Χρέωση', style: 'tableHeader'},
      { text: 'Πίστωση', style: 'tableHeader'},
      { text: 'Υπόλοιπο', style: 'tableHeader'}
    ]);

    _.each(midexItems, item => {
      if (item.type.id === 'invoice') {
        content = content.concat(createInvoice(item));
      } else {
        content.push(createReceipt(item));
      }
    });

    return {
      body: content
    };
  }

  function createUserInfoLayout() {
    return {
      hLineWidth: (i, node) => (i === 0 || i === node.table.body.length) ? 1 : 0,
      vLineWidth: (i, node) => (i === 0 || i === node.table.widths.length) ? 1 : 0,
      hLineColor: (i, node) => (i === 0 || i === 1 || i === node.table.body.length) ? 'black' : 'gray',
      vLineColor: (i, node) => (i === 0 || i === node.table.widths.length) ? 'black' : 'gray'
     };
  }

  function createContentLayout() {
    return {
      hLineWidth: (i, node) => (i === 0 || i === 1 || i === 2 || i === node.table.body.length) ? 1 : 0,
      vLineWidth: (i, node) => (i === 0 || i === node.table.widths.length) ? 1 : 0,
      hLineColor: (i, node) => (i === 0 || i === 1 || i === node.table.body.length) ? 'black' : 'gray',
      vLineColor: (i, node) => (i === 0 || i === node.table.widths.length) ? 'black' : 'gray'
     };
  }
}

})();


// var dd = {
//   content: [
// {
//   columns: [
//     {
//       text: 'TSIOLKAS',
//       width: 140
//     },
//     {
//       text: 'Periodos 11/20/2014 - 22/10/2015',
//       width: 300
//     },
//     {
//       text: '11/23/2012',
//       width: 100
//     }
//   ]
// },
//     {
//       table: {
//           headerRows: 1,
//           body: [
//               ['Κωδικός', { text: 'Β2', style: 'useDetail'}, 'Επάγγελμα', { text: 'ΕΜΠΟΡΟΣ', style: 'useDetail'}, 'Τηλέφωνο', { text: '210-4811725', style: 'useDetail'}],
//               ['Επωνημία', { text: 'ΚΑΒΒΑΔΙΑΣ', style: 'useDetail'}, 'Δ.Ο.Υ', { text: 'ΜΟΣΧΑΤΟΥ', style: 'useDetail'}, 'Κινητό', { text: ' ', style: 'useDetail'}],
//               ['Διεύθυνση', { text: 'Β2-4-6 ΚΛΑ', style: 'useDetail'}, 'Α.Φ.Μ.', { text: '99898932', style: 'useDetail'}, 'Αποπληρωμή', { text: '0', style: 'useDetail'}]
//           ]
//       },
//       layout: 'noBorders'
//     },
//     {
//         table: {
//         body: [
//             [
//               { text: 'Κινήσεις', style: 'tableTitle', colSpan: 4, alignment: 'center'}, {}, {}, {},
//               { text: 'Προοδευτικά', style: 'tableTitle', colSpan: 3, alignment: 'center'}, {}, {}
//             ],
//             [
//               { text: 'Ημερομηνία', style: 'tableHeader'},
//               { text: 'Παραστατικό', style: 'tableHeader'},
//               { text: 'Χρέωση', style: 'tableHeader'},
//               { text: 'Πίστωση', style: 'tableHeader'},
//               { text: 'Χρέωση', style: 'tableHeader'},
//               { text: 'Πίστωση', style: 'tableHeader'},
//               { text: 'Υπόλοιπο', style: 'tableHeader'}
//             ],
//             [
//               '12/10/2014',
//               { text: 'ΤΙΜΟΛΟΓΙΟ - ΔΕΛΤΙΟ ΑΠΟΣΤΟΛΗΣ - 1615'},
//               { text:'671,22'},
//               { text:'0,00'},
//               '90.246,77',
//               '89.575,55',
//               '671,22'
//              ] ,
//             [
//               { text: 'Κωδικός', style: 'products'},
//               'Περιγραφή',
//               'Ποσότητα',
//               'Τιμή Μοναδας',
//               'Καθαρή Αξία',
//               'Αξία ΦΠΑ',
//               'Σύνολο'
//             ],
//             [
//               'Π121',
//               'FRUTOBOX ΣΑΚΟΥΛΑΚΙ',
//               '600,00',
//               '0,33',
//               '198,00',
//               '25,74',
//               '223,74'
//             ]
//         ]},
//           layout: {
//             hLineWidth: function(i, node) {
//               return (i === 0 || i === 1 || i === node.table.body.length) ? 2 : 1;
//             },
//             vLineWidth: function(i, node) {
//               return (i === 0 || i === node.table.widths.length) ? 2 : 1;
//             },
//             hLineColor: function(i, node) {
//               return (i === 0 || i === 1 || i === node.table.body.length) ? 'black' : 'gray';
//             },
//             vLineColor: function(i, node) {
//               return (i === 0 || i === node.table.widths.length) ? 'black' : 'gray';
//             }
//         }
//     }

//   ],
//   styles: {
//     useDetail: {
//       bold: true
//     },
//     tableTitle: {
//       bold: true
//     },
//     tableHeader: {
//       bold: true,
//       fontSize: 13,
//       color: 'black'
//     },
//     products: {
//       color: '#444'
//     }
//   }

// }


