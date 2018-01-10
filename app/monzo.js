"use strict";
const _ = require("lodash");
const request = require("request");
const AmazonDateParser = require("amazon-date-parser");
const common = require("./common.js");

const VERSION = "1.0";
const access_token =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjaSI6Im9hdXRoY2xpZW50XzAwMDA5NFB2SU5ER3pUM2s2dHo4anAiLCJleHAiOjE1MTU2MTc1MjAsImlhdCI6MTUxNTU5NTkyMCwianRpIjoidG9rXzAwMDA5U1NLUGtHTGdoeDFQUlJESHQiLCJ1aSI6InVzZXJfMDAwMDk2RmFETEdNcmdjQjdtVFhJZiIsInYiOiIyIn0.HdtY8B1FSkm3G47RCFLXm1GgrX7y6lCO_SByvvEviHg";
const BASE_URL = "https://api.monzo.com/";

module.exports = function(req, res) {
  const requestType = req.body.request.type;
  if (requestType === "LaunchRequest") {
    res.json(
      buildResponse(
        { dateRequested: true },
        "<speak>Hello, this is your Monzo skill. Ask for your balance.</speak>",
        {},
        false
      )
    );
  } else if (requestType === "SessionEndedRequest") {
    if (req.body.request.reason === "ERROR") {
      console.error("Alexa ended the session due to an error");
    }
  } else if (requestType === "IntentRequest") {
    const intentName = req.body.request.intent.name;
    if (intentName === "Balance") {
      getBalance()
        .then(alexaOutput => processSpeech(alexaOutput, true, res))
        .catch(err => processErrorSpeech(err, res));
    } else if (
      intentName === "Transactions"
    ) {
      getTransactions(req.body.request.intent.slots.amount.value)
        .then(alexaOutput => processSpeech(alexaOutput, true, res))
        .catch(err => processErrorSpeech(err, res));
    } else if (
      intentName === "LastTopUp"
    ) {
      getLastTopUp()
        .then(alexaOutput => processSpeech(alexaOutput, true, res))
        .catch(err => processErrorSpeech(err, res));
    } else if (
      intentName === "LastSpend"
    ) {
      const amazonDate = new AmazonDateParser(
        req.body.request.intent.slots.duration.value
      );
      getLastTimePeriodSpend(amazonDate)
        .then(alexaOutput => processSpeech(alexaOutput, true, res))
        .catch(err => processErrorSpeech(err, res));
    } else if (
      intentName === "SpendByVendor"
    ) {
      const vendor = req.body.request.intent.slots.vendor.value;
      getTotalVendorSpend(vendor.toLowerCase())
        .then(alexaOutput => processSpeech(alexaOutput, true, res))
        .catch(err => processErrorSpeech(err, res));
    } else if (
      intentName === "ListVendors"
    ) {
      getVendors()
        .then(alexaOutput => processSpeech(alexaOutput, true, res))
        .catch(err => processErrorSpeech(err, res));
    } else if (
      intentName === "ListVendorsByDate"
    ) {
      const amazonDate = new AmazonDateParser(
        req.body.request.intent.slots.duration.value
      );
      getVendorsByDate(amazonDate)
        .then(alexaOutput => processSpeech(alexaOutput, true, res))
        .catch(err => processErrorSpeech(err, res));
    } else if (
      intentName === "LastTransaction"
    ) {
      getLastTransaction()
        .then(alexaOutput => processSpeech(alexaOutput, true, res))
        .catch(err => processErrorSpeech(err, res));
    } else {
      res.status(504).json({
        message: "Sorry that Intent has not been added to our skill set"
      });
    }
  }
};

function processErrorSpeech(err, res) {
  res.json(buildResponse({}, "<speak>" + err + "</speak>", {}, true));
}

function processSpeech(alexaOutput, endSession, res) {
  res.json(
    buildResponse(
      {},
      "<speak>" + alexaOutput.text + "</speak>",
      alexaOutput.card,
      endSession
    )
  );
}

function buildResponse(session, speech, card, end) {
  return {
    version: VERSION,
    sessionAttributes: session,
    response: {
      outputSpeech: {
        type: "SSML",
        ssml: speech
      },
      card: card,
      shouldEndSession: !!end
    }
  };
}

function getLastTransaction() {
  return new Promise((resolve, reject) => {
    request(
      {
        url:
          BASE_URL +
          "transactions?expand[]=merchant&account_id=acc_00009RwlYFxmBrRmHYTLKz",
        headers: {
          Authorization: `Bearer ${access_token}`
        },
        json: true
      },
      function(err, res, body) {
        let text, card;
        if (err || res.statusCode >= 400) {
          console.error(res.statusCode, err);
          return reject("Unable to get transactions!");
        }

        if (!body) {
          return reject("Unable to get transactions!");
        }

        const transactionText = getLastTransactionText(
          body
        );

        if (transactionText != null) {
          text = `Your last transaction was: ${transactionText}`;
        } else {
          text = "Sorry couldn't get your last transaction.";
        }

        card = {
          type: "Standard",
          title: "Monzo card transactions",
          text: text
        };

        resolve({ text, card });
      }
    );
  });
}

function getVendorsByDate(amazonDate) {
  const start = new Date(amazonDate.startDate);
  const end = new Date(amazonDate.endDate);
  return new Promise((resolve, reject) => {
    request(
      {
        url:
          BASE_URL +
          "transactions?expand[]=merchant&account_id=acc_00009RwlYFxmBrRmHYTLKz&since=" +
          start.toISOString() +
          "&before=" +
          end.toISOString(),
        headers: {
          Authorization: `Bearer ${access_token}`
        },
        json: true
      },
      function(err, res, body) {
        let text, card;
        if (err || res.statusCode >= 400) {
          console.error(res.statusCode, err);
          return reject("Unable to get vendors!");
        }

        if (!body) {
          return reject("Unable to get vendors!");
        }

        const vendorList = getListOfVendors(body);

        if (vendorList != null) {
          if (vendorList.length > 1) {
            const lastItem = vendorList.pop();
            text = `You've visited: ${vendorList.join(", ")} and ${lastItem}`;
          } else {
            text = `You've visited: ${vendorList.join(", ")}`;
          }
        } else {
          text =
            "Sorry, Couldn't get the list of places you've spent money at.";
        }

        card = {
          type: "Standard",
          title: "Monzo shops visited",
          text: text
        };

        resolve({ text, card });
      }
    );
  });
}

function getVendors() {
  return new Promise((resolve, reject) => {
    request(
      {
        url:
          BASE_URL +
          "transactions?expand[]=merchant&account_id=acc_00009RwlYFxmBrRmHYTLKz",
        headers: {
          Authorization: `Bearer ${access_token}`
        },
        json: true
      },
      function(err, res, body) {
        let text, card;
        if (err || res.statusCode >= 400) {
          console.error(res.statusCode, err);
          return reject("Unable to get vendors!");
        }

        if (!body) {
          return reject("Unable to get vendors!");
        }

        const vendorList = getListOfVendors(body);

        if (vendorList != null) {
          if (vendorList.length > 1) {
            const lastItem = vendorList.pop();
            text = `You've visited: ${vendorList.join(", ")} and ${lastItem}`;
          } else {
            text = `You've visited: ${vendorList.join(", ")}`;
          }
        } else {
          text =
            "Sorry, Couldn't get the list of places you've spent money at.";
        }

        card = {
          type: "Standard",
          title: "Monzo shops visited",
          text: text
        };

        resolve({ text, card });
      }
    );
  });
}

function getBalance() {
  return new Promise((resolve, reject) => {
    request(
      {
        url: BASE_URL + "balance?account_id=acc_00009RwlYFxmBrRmHYTLKz",
        headers: {
          Authorization: `Bearer ${access_token}`
        },
        json: true
      },
      function(err, res, body) {
        let text, card;
        if (err || res.statusCode >= 400) {
          console.error(res.statusCode, err);
          return reject("Unable to get balance!");
        }

        if (!body) {
          return reject("Unable to get balance!");
        }

        text = `Your balance is: ${getBalanceText(body)}`;
        card = {
          type: "Standard",
          title: "Monzo card balance",
          text: text
        };

        resolve({ text, card });
      }
    );
  });
}

function getTransactions(numberOfTransactions) {
  return new Promise((resolve, reject) => {
    request(
      {
        url:
          BASE_URL +
          "transactions?expand[]=merchant&account_id=acc_00009RwlYFxmBrRmHYTLKz",
        headers: {
          Authorization: `Bearer ${access_token}`
        },
        json: true
      },
      function(err, res, body) {
        let text, card;
        if (err || res.statusCode >= 400) {
          console.error(res.statusCode, err);
          return reject("Unable to get transactions!");
        }

        if (!body) {
          return reject("Unable to get transactions!");
        }

        const transactionsText = getTransactionsText(
          body,
          numberOfTransactions
        );

        if (transactionsText.length > 0) {
          text = `Your last ${numberOfTransactions} transactions are: ${transactionsText}`;
        } else {
          text = "Sorry, no transactions available";
        }

        card = {
          type: "Standard",
          title: "Monzo card transactions",
          text: text
        };

        resolve({ text, card });
      }
    );
  });
}

function getLastTopUp() {
  return new Promise((resolve, reject) => {
    request(
      {
        url:
          BASE_URL +
          "transactions?expand[]=merchant&account_id=acc_00009RwlYFxmBrRmHYTLKz",
        headers: {
          Authorization: `Bearer ${access_token}`
        },
        json: true
      },
      function(err, res, body) {
        let text, card;
        if (err || res.statusCode >= 400) {
          console.error(res.statusCode, err);
          return reject("Unable to get last top up!");
        }

        if (!body) {
          return reject("Unable to get last top up!");
        }

        const topUpText = getLastTopUpText(body);

        if (topUpText != null) {
          text = topUpText;
        } else {
          text = "Couldn't get your last top up.";
        }

        card = {
          type: "Standard",
          title: "Monzo last top up",
          text: text
        };

        resolve({ text, card });
      }
    );
  });
}

function getLastTimePeriodSpend(amazonDate) {
  const start = new Date(amazonDate.startDate);
  const end = new Date(amazonDate.endDate);
  return new Promise((resolve, reject) => {
    request(
      {
        url:
          BASE_URL +
          "transactions?expand[]=merchant&account_id=acc_00009RwlYFxmBrRmHYTLKz&since=" +
          start.toISOString() +
          "&before=" +
          end.toISOString(),
        headers: {
          Authorization: `Bearer ${access_token}`
        },
        json: true
      },
      function(err, res, body) {
        let text, card;
        if (err || res.statusCode >= 400) {
          console.error(res.statusCode, err, res);
          return reject("Unable to get last spend!");
        }

        if (!body) {
          return reject("Unable to get last spend!");
        }

        const lastSpendText = getLastTimePeriodSpendText(body);

        if (lastSpendText != null) {
          text = lastSpendText;
        } else {
          text =
            "Couldn't get your last spend for the time period you provided.";
        }

        card = {
          type: "Standard",
          title: "Monzo last transactions",
          text: text
        };

        resolve({ text, card });
      }
    );
  });
}

function getTotalVendorSpend(vendor) {
  return new Promise((resolve, reject) => {
    request(
      {
        url:
          BASE_URL +
          "transactions?expand[]=merchant&account_id=acc_00009RwlYFxmBrRmHYTLKz",
        headers: {
          Authorization: `Bearer ${access_token}`
        },
        json: true
      },
      function(err, res, body) {
        let text, card;
        if (err || res.statusCode >= 400) {
          console.error(res.statusCode, err, res);
          return reject("Unable to get the total spend for that vendor!");
        }

        if (!body) {
          return reject("Unable to get the total spend for that vendor!");
        }

        const vendorSpendText = getTotalVendorSpendText(body, vendor);

        if (vendorSpendText != null) {
          text = vendorSpendText;
        } else {
          text = `Couldn't get the total spend for ${vendor}.`;
        }

        card = {
          type: "Standard",
          title: "Monzo Vendor Spend",
          text: text
        };

        resolve({ text, card });
      }
    );
  });
}

function getListOfVendors(data) {
  let vendorSpendText = [];

  if (data.transactions) {
    for (let transaction of data.transactions) {
      if (transaction.merchant != null) {
        const merchantName = transaction.merchant.name.toLowerCase();
        vendorSpendText.push(merchantName);
      }
    }
  }

  return _.uniq(vendorSpendText);
}

function getLastTransactionText(data) {
  let transactionText;
  let lastTransaction;
  if (data.transactions) {
    for (let transaction of data.transactions.reverse()) {
      if (transaction.is_load === false) {
        lastTransaction = transaction;
        transactionText = `You spent ${common.getCashText(Math.abs(transaction.amount))} at ${
          transaction.merchant.name
        } on ${common.dateFormatter(transaction.created)}. `
        break;
      }
    }
  }

  return transactionText;
}

function getTotalVendorSpendText(data, vendor) {
  let totalSpend = 0;
  let vendorSpendText;

  if (data.transactions) {
    for (let transaction of data.transactions) {
      if (transaction.merchant != null) {
        const merchantName = transaction.merchant.name.toLowerCase();
        if (merchantName.includes(vendor) || vendor.includes(merchantName)) {
          const amount = parseInt(transaction.amount);
          if (!isNaN(amount)) {
            totalSpend += Math.abs(amount);
          }
        }
      }
    }
    if (totalSpend === 0) {
      vendorSpendText = `Sorry couldn't find any transactions for ${vendor}.`;
    } else {
      vendorSpendText = `At ${vendor} you spent ${common.getCashText(totalSpend)}`;
    }
  }

  return vendorSpendText;
}

function getLastTimePeriodSpendText(data) {
  let spendText;
  let totalSpend = 0;

  if (data.transactions) {
    for (let transaction of data.transactions) {
      if (transaction.amount < 0) {
        const amount = parseInt(transaction.amount);
        if (!isNaN(amount)) {
          totalSpend += Math.abs(amount);
        }
      }
    }

    spendText = `You spent ${common.getCashText(totalSpend)}`;
  }

  return spendText;
}

function getLastTopUpText(data) {
  let topUpText;

  if (data.transactions) {
    const reversedTransactions = data.transactions.reverse();
    for (let transaction of reversedTransactions) {
      if (transaction.description === "Top up") {
        topUpText = `You topped up ${common.getCashText(
          transaction.amount
        )} on ${common.dateFormatter(transaction.created)}. `;
        break;
      }
    }
  }
  return topUpText;
}

function getTransactionsText(data, transactionAmount) {
  let transactionsText = "";

  if (data.transactions) {
    const lastSetOfTransactions = data.transactions
      .slice(
        data.transactions.length - transactionAmount,
        data.transactions.length
      )
      .reverse();

    lastSetOfTransactions.forEach(transaction => {
      const amountSpend = transaction.amount;
      let transactionText = "";
      if (transaction.description === "Top up") {
        transactionText = `Top Up of ${common.getCashText(
          amountSpend
        )} on ${common.dateFormatter(transaction.created)}. `;
      } else if (Object.keys(transaction.counterparty).length > 0) {
        if (transaction.amount > 0) {
          transactionText = `Got Paid ${common.getCashText(amountSpend)} from ${
            transaction.counterparty.prefered_name
          } on ${common.dateFormatter(transaction.created)}. `;
        } else {
          transactionText = `You paid ${
            transaction.counterparty.prefered_name
          }, ${common.getCashText(Math.abs(amountSpend))} on ${common.dateFormatter(
            transaction.created
          )}. `;
        }
      } else if (
        transaction.merchant != null &&
        Object.keys(transaction.merchant).length > 0
      ) {
        transactionText = `Spent ${common.getCashText(Math.abs(amountSpend))} at ${
          transaction.merchant.name
        } on ${common.dateFormatter(transaction.created)}. `;
      }
      transactionsText += transactionText;
    });
  }

  return transactionsText;
}

function getBalanceText(data) {
  let conditions;
  if (data.balance) {
    conditions = common.getCashText(data.balance);
  }

  return conditions;
}
