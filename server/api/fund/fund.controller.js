/**
 * Using Rails-like standard naming convention for endpoints.
 * GET     /fund              ->  index
 * POST    /fund              ->  create
 * GET     /fund/:id          ->  show
 * PUT     /fund/:id          ->  update
 * DELETE  /fund/:id          ->  destroy
 */

'use strict';

var _ = require('lodash');
var fund = require('./fund.model');
var mongoose = require('mongoose');
var userModel = require('../user/user.model');
var transaction = require('../transaction/transaction.model');
var Request = require('request');
var Stock = require('../stock/stock.model');


function setPercentLeftToInvest(selectedFund) {
  var remainingInvestment = 100;

  selectedFund.stocks.forEach(function (stock) {
    if (selectedFund.stocks.length > 0 && selectedFund.finalized == true) {
      remainingInvestment -= stock.currentPercentOfFund;
    }
    else {
      remainingInvestment -= stock.originalPercentOfFund;
    }
  });

  selectedFund.set({"percentLeftToInvest": remainingInvestment});
}


// Get list of funds
exports.index = function (req, res) {

  fund.find(function (err, fund) {
    if (err) {
      return handleError(res, err);
    }
    if (!fund) {
      return res.send(404);
    }
    return res.json(fund);
  });
};

exports.getFund = function (req, res) {

  console.log('fund.controller: init');

  var user = req.user;

  fund.findById(req.params.id, function (err, selectedFund) {
    if (err) {
      return handleError(res, err);
    }
    if (!fund) {
      return res.send(404);
    }

    user.selectedFund = fund._id;

    user.save(function (errs) {
      if (errs) {
        console.log(errs);
        return res.render('500');
      }

      return res.json(selectedFund);

      console.log('saving user selectedFund');
    });
  });
};

// Get a single fund w/stock updates
function UpdateInitializedFunds(selectedFund, res,  updatedFund) {
  var investmentUpdateCount = 0;
  var selectedFundCash = selectedFund.goal;

  selectedFund.stocks.forEach(function (stock) {

    var stockRequestOptions = {
      url: 'http://finance.google.com/finance/info?q=' + stock.symbol,
      json: true
    };

    console.log('GetStockCurrentPrice: getting current price for: ' + stock.symbol);

    Request(stockRequestOptions, function (error, response, body) {
        if (!error && response.statusCode === 200) {

          var result = JSON.parse(body.replace("//", ""));
          var currentPrice = result[0].l;
          console.log('GetStockCurrentPrice: current price for: ' + stock.symbol + ' - ' + currentPrice);


          var currentPercentOfFund = ((stock.currentNumberOfShares * currentPrice) / selectedFund.goal) * 100;
          var cashForPurchase = (selectedFund.goal * (currentPercentOfFund / 100));
          var numberOfShares = cashForPurchase / currentPrice;
          var currentCashInvestment = Math.floor((numberOfShares * currentPrice) * 100) / 100;

          console.log('stock.currentPrice: ' + currentPrice);
          console.log('stock.currentNumberOfShares: ' + numberOfShares);
          console.log('stock.currentPercentOfFund: ' + currentPercentOfFund);

          selectedFundCash -= cashForPurchase;

          fund.update(
            {
              '_id': mongoose.Types.ObjectId(selectedFund._id),
              'stocks._id': mongoose.Types.ObjectId(stock._id)
            },
            {
              $set: {
               // 'cash' : selectedFundCash,
                'stocks.$.currentPrice': currentPrice,
                'stocks.$.created': Date(),
                'stocks.$.currentNumberOfShares': numberOfShares,
                'stocks.$.currentPercentOfFund': currentPercentOfFund,
                'stocks.$.currentCashInvestment': currentCashInvestment
              //  'stocks.$.originalCashInvestment': currentCashInvestment
              }
            },
            function (err, result) {
              if (err) {
                return handleError(result, err);
              }

              investmentUpdateCount++;

              if(selectedFund.stocks.length == investmentUpdateCount) {
                if(typeof updatedFund == "function") {
                  updatedFund(selectedFund);
                }
              }

              console.log('GetStockCurrentPrice: updating DB with current price for: ' + stock.symbol);
            });
        }
      }
    );
  });
}

function UpdatePreInitializedFunds(selectedFund, req, updatedFund) {

  var selectedFundCash = selectedFund.goal;
  var investmentUpdateCount = 0;

  selectedFund.stocks.forEach(function (stock)  {

    console.log('GetStockCurrentPrice: updating DB with current price for: ' + stock.symbol);

    var stockRequestOptions = {
      url: 'http://finance.google.com/finance/info?q=' + stock.symbol,
      json: true
    };

    Request(stockRequestOptions, function (error, response, body) {
      if (!error && response.statusCode === 200) {
        var result = JSON.parse(body.replace("//", ""));

        req.body.exchange = result[0].e;
        req.body.price = result[0].l; //Stock price
        var cashForPurchase = (selectedFund.goal * (stock.originalPercentOfFund / 100)); //goal is total amount invested
        var sharesToPurchase = (cashForPurchase / req.body.price) * 100 / 100;
        req.body.numberOfShares = sharesToPurchase;
        req.body.change = result[0].c; //Stock change
        var investmentAmount = req.body.numberOfShares * req.body.price; //Money invested
        //var percentOfFund = investmentAmount / selectedFund.goal * 100; //percent of fund allocated

        selectedFundCash -= cashForPurchase;

        fund.update(
          {
            '_id': mongoose.Types.ObjectId(selectedFund._id),
            'stocks._id': mongoose.Types.ObjectId(stock._id)
          },
          {
            $set: {
              'cash' : selectedFundCash,
              'stocks.$.price': req.body.price,
              'stocks.$.created': Date(),
              'stocks.$.currentPrice': req.body.price,
              'stocks.$.numberOfShares': req.body.numberOfShares,
              'stocks.$.currentNumberOfShares': req.body.numberOfShares,

              //'stocks.$.currentPercentOfFund': percentOfFund,
              //'stocks.$.originalPercentOfFund': percentOfFund,
              //'stocks.$.currentCashInvestment': (req.body.numberOfShares * req.body.price) * 100 / 100,
              //'stocks.$.originalCashInvestment': (req.body.numberOfShares * req.body.price) * 100 / 100
            }
          },
          function (err, result) {
            if (err) {
              return handleError(result, err);
            }

            investmentUpdateCount++;

            if(selectedFund.stocks.length == investmentUpdateCount) {
              if(typeof updatedFund == "function") {
                updatedFund(selectedFund);
              }
            }
          });
      }
    })
  })
}

exports.show = function (req, res) {

    console.log('fund.controller: init');

    var user = req.user;

    fund.findById(req.params.id, function (err, selectedFund) {
      if (err) {
        return handleError(res, err);
      }
      if (!fund) {
        return res.send(404);
      }

      if (selectedFund.stocks.length > 0) {
        if (selectedFund.finalized == true) {
          UpdateInitializedFunds(selectedFund, res, function(selectedFund) {
            setPercentLeftToInvest(selectedFund);
            return res.send(selectedFund);
          });
        }
        else {

          UpdatePreInitializedFunds(selectedFund, req, function(selectedFund) {
            return res.send(selectedFund);
          });
        }
      }
      else
      {
        return res.send(selectedFund);
      }

      user.selectedFund = fund._id;



      user.save(function (errs) {
        if (errs) {
          console.log(errs);
          return res.render('500');
        }

        console.log('saving user selectedFund');
      });




    });
  };

// Creates a new fund in the DB.
  exports.create = function (req, res) {

    var user = req.user;

    fund.create(req.body, function (err, fund) {
      if (err) {
        return handleError(res, err);
      }

      console.log("create fund");

      user.funds.push(fund);
      user.selectedFund = fund._id;

      user.save(function (errs) {
        if (errs) {
          console.log(errs);
          return res.render('500');
        }

        transaction.create(
          {
            fundId: fund._id,
            date: new Date(),
            symbol: 'YMMF',
            description: 'Add money to YMMF',
            price: 1,
            action: 'Buy',
            numberOfShares: fund.cash,
            total: fund.cash,
            company: 'Your Money Market Fund',
            active: true,
            renderOnPreInit: true
          }, function (errs) {
            if (err) {
              return handleError(res, err);
            }

            console.log('fund.controller: saving fund transaction');
          });


        console.log('saving user fund');
      });

      return res.json(201, user);
    });

  };

// Updates an existing fund in the DB.
  exports.update = function (req, res) {
    if (req.body._id) {
      delete req.body._id;
    }


    function updateFundInvestementPercentages(updatedFund) {


      if (updatedFund.stocks.length > 0) {
        if (updatedFund.finalized == false) {
          updatedFund.stocks.forEach(function (stock) {
            fund.update(
              {'_id': mongoose.Types.ObjectId(updatedFund._id), 'stocks._id': mongoose.Types.ObjectId(stock._id)},
              {
                $set: {
                  'stocks.$.originalPercentOfFund': ((stock.numberOfShares * stock.price) / updatedFund.goal) * 100
                }
              }, function (err, result) {
                if (err) {
                  return handleError(result, err);
                }
              }
            );
          });
        }
        else {
          updatedFund.stocks.forEach(function (stock) {
            fund.update(
              {'_id': mongoose.Types.ObjectId(updatedFund._id), 'stocks._id': mongoose.Types.ObjectId(stock._id)},
              {
                $set: {
                  // 'stocks.$.originalPercentOfFund': ((stock.numberOfShares * stock.currentPrice) / updatedFund.goal) * 100,
                  'stocks.$.currentPercentOfFund': ((stock.numberOfShares * stock.currentPrice) / updatedFund.goal) * 100
                }
              }, function (err, result) {
                if (err) {
                  return handleError(result, err);
                }
              }
            );
          });
        }

      }
    }

    fund.findById(req.params.id, function (err, selectedFund) {
      if (err) {
        return handleError(res, err);
      }
      if (!selectedFund) {
        return res.send(404);
      }

      var cashDifference = req.body.cash - selectedFund.cash;

      var action = 'Add';

      if (req.body.cash <= selectedFund.cash) {
        action = 'Sell';
      }

      var updatedFund = _.merge(selectedFund, req.body);

      updateFundInvestementPercentages(updatedFund);

      updatedFund.save(function (err) {
        if (err) {
          return handleError(res, err);
        }

        transaction.create(
          {
            fundId: fund._id,
            date: new Date(),
            symbol: 'YMMF',
            description: action + ' funds to/from YMMF',
            price: 1,
            action: action,
            numberOfShares: cashDifference,
            total: fund.cash,
            company: 'Your Money Market Fund',
            active: true,
            renderOnPreInit: true
          }, function (err, result) {
            if (err) {
              return handleError(result, err);
            }

            return res.json(200, updatedFund);

            console.log('fund.controller: Updating YMMF transaction');
          });
      });
    });
  };

// Deletes a fund from the users fund collection.
  exports.destroy = function (req, res) {

    var user = req.user;

    userModel.update({'_id': user._id},
      {$pull: {"funds": {_id: mongoose.Types.ObjectId(req.params.id)}}},
      function (err, result) {
        if (err) {
          return handleError(result, err);
        }
        else {
          console.log(result);
          return res.send(204);
        }
      });
  };

  exports.finalize = function (req, res) {

    var user = req.user;
    var selectedStock;

    fund.findById(req.params.id, function (err, fund) {
      if (err) {
        return handleError(res, err);
      }
      if (!fund) {
        return res.send(404);
      }

      fund.set({"finalized": true});
      fund.save();

      userModel.update(
        {'_id': user._id, 'funds._id': mongoose.Types.ObjectId(req.params.id)},
        {$set: {'funds.$.finalized': true}},
        function (err, result) {
          if (err) {
            return handleError(result, err);
          }
          else {
            console.log(result);
            return res.send(204);
          }
        });
    });

  };


  function handleError(res, err) {
    return res.send(500, err);
  }
