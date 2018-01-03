"use strict";

let request = require("request");

const VERSION = "1.0";
const access_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjaSI6Im9hdXRoY2xpZW50XzAwMDA5NFB2SU5ER3pUM2s2dHo4anAiLCJleHAiOjE1MTUwMjA5MjIsImlhdCI6MTUxNDk5OTMyMiwianRpIjoidG9rXzAwMDA5U0UxMThTYnh2cDBQV1JVcmgiLCJ1aSI6InVzZXJfMDAwMDk2RmFETEdNcmdjQjdtVFhJZiIsInYiOiIyIn0.1qlwExhsmXmnDvUjGfHfMmvtDtHtj5rsJhks13dR2Pw"
const BASE_URL = "https://api.monzo.com/";

module.exports = function(req, res) {
  if (req.body.request.type === "LaunchRequest") {
    res.json(
      buildResponse(
        { dateRequested: true },
        "<speak>Hello Jack, this is your monzo skill. Ask for your balance.</speak>",
        {},
        false
      )
    );
  } else if (req.body.request.type === "SessionEndedRequest") {
    if (req.body.request.reason === "ERROR") {
      console.error("Alexa ended the session due to an error");
    }
  } else if (
    req.body.request.type === "IntentRequest" &&
    req.body.request.intent.name === "Balance"
  ) {
    getBalance()
      .then(function(balance) {
        res.json(
          buildResponse(
            {},
            "<speak>" + balance.text + "</speak>",
            balance.card,
            true
          )
        );
      })
      .catch(function(err) {
        res.json(buildResponse({}, "<speak>" + err + "</speak>", {}, true));
      });
  } 
  else if (
    req.body.request.type === "IntentRequest" &&
    req.body.request.intent.name === "Transactions"
  ) {
    getTransactions(req.body.request.intent.slots.amount.value)
      .then(function(transactions) {
        res.json(
          buildResponse(
            {},
            "<speak>" + transactions.text + "</speak>",
            transactions.card,
            true
          )
        );
      })
      .catch(function(err) {
        res.json(buildResponse({}, "<speak>" + err + "</speak>", {}, true));
      });
  }
  else if (
    req.body.request.type === "IntentRequest" &&
    req.body.request.intent.name === "LastTopUp"
  ) {
    getLastTopUp()
    .then(function(lastTopUp) {
      res.json(
        buildResponse(
          {},
          "<speak>" + lastTopUp.text + "</speak>",
          lastTopUp.card,
          true
        )
      );
    })
    .catch(function(err) {
      res.json(buildResponse({}, "<speak>" + err + "</speak>", {}, true));
    });
  }
  else {
    res
      .status(504)
      .json({
        message: "Sorry that Intent has not been added to our skill set"
      });
  }
};

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
        let data, text, card;
        data = body;
        if (err || res.statusCode >= 400) {
          console.error(res.statusCode, err);
          return reject("Unable to get balance!");
        }

        if (!data) {
          return reject("Unable to get balance!");
        }

        text = `Your balance is: ${getBalanceText(data)}`;
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
        url: BASE_URL + "transactions?expand[]=merchant&account_id=acc_00009RwlYFxmBrRmHYTLKz",
        headers: {
          Authorization: `Bearer ${access_token}`
        },
        json: true
      },
      function(err, res, body) {
        let data, text, card;
        data = body;
        if (err || res.statusCode >= 400) {
          console.error(res.statusCode, err);
          return reject("Unable to get transactions!");
        }

        if (!data) {
          return reject("Unable to get transactions!");
        }

        const transactionsText = getTransactionsText(data, numberOfTransactions);

        if (transactionsText.length > 0) {
          text = `Your last ${numberOfTransactions} transactions are: ${transactionsText}`;
        }
        else {
          text = 'Sorry, no transactions available';
        }

        card = {
          type: "Standard",
          title: "Monzo card transactions",
          text: text
        };

        resolve({ text, card });
      }
    )
  });
}

function getLastTopUp() {
  return new Promise((resolve, reject) => {
    request(
      {
        url: BASE_URL + "transactions?expand[]=merchant&account_id=acc_00009RwlYFxmBrRmHYTLKz",
        headers: {
          Authorization: `Bearer ${access_token}`
        },
        json: true
      },
      function(err, res, body) {
        let data, text, card;
        data = body;
        if (err || res.statusCode >= 400) {
          console.error(res.statusCode, err);
          return reject("Unable to get last top up!");
        }

        if (!data) {
          return reject("Unable to get last top up!");
        }

        const topUpText = getLastTopUpText(data);
        
        if (topUpText != null) {
          text = topUpText;
        } else {
          text = "Couldn't get your last top up."
        }

        card = {
          type: "Standard",
          title: "Monzo card transactions",
          text: text
        };

        resolve({ text, card });
      }
    )
  });
}

function getLastTopUpText(data) {
  let topUpText;

  if (data.transactions) {
    for (let transaction in data.transactions.reverse()) {
      let amountSpend = transaction.amount;
      console.log(transaction);
      if (transaction.description === 'Top up'){
        topUpText = `You topped up ${getCashText(amountSpend)} on ${dateFormatter(transaction.created)}. `;
        break;
      }
    }
  }
  return topUpText;
}

function getTransactionsText(data, transactionAmount) {
  let transactionsText = '';

  if (data.transactions) {
    let lastSetOfTransactions = data.transactions.slice((data.transactions.length - transactionAmount), data.transactions.length).reverse();

    lastSetOfTransactions.forEach(transaction => {
        let amountSpend = transaction.amount;
        let transactionText = '';
        console.log(transaction);
        if (transaction.description === 'Top up'){
          transactionText = `Top Up of ${getCashText(amountSpend)} on ${dateFormatter(transaction.created)}. `;
        }
        else if (Object.keys(transaction.counterparty).length > 0) {
          if (transaction.amount > 0) {
            transactionText = `Got Paid ${getCashText(amountSpend)} from ${transaction.counterparty.prefered_name} on ${dateFormatter(transaction.created)}. `;
          }
          else {
            transactionText = `You paid ${transaction.counterparty.prefered_name}, ${getCashText(Math.abs(amountSpend))} on ${dateFormatter(transaction.created)}. `
          }
        }
        else if (transaction.merchant != null && Object.keys(transaction.merchant).length > 0) {
          transactionText = `Spent ${getCashText(Math.abs(amountSpend))} at ${transaction.merchant.name} on ${dateFormatter(transaction.created)}. `;
        }
        console.log(transactionText);
        transactionsText += transactionText;
    });
  }

  return transactionsText;
}

function getBalanceText(data) {
  let conditions;
  if (data.balance) {
    conditions = getCashText(data.balance);
  }

  return conditions;
}

const getCashText = (cash) => {
  const poundsAndPence = (cash / 100)
      .toFixed(2)
      .toString()
      .split(".");

    const pounds = +poundsAndPence[0];
    const pence = +poundsAndPence[1];

    const responseParts = [];
    if (pounds !== 0 || pence === 0)
      responseParts.push(
        `${pounds} ${currencyParser["GBP"].pounds(
          pounds
        )}`
      );

    if (pence !== 0 || pounds === 0)
      responseParts.push(
        `${pence} ${currencyParser["GBP"].pence(
          pence
        )}`
      );

    return responseParts.join(" and ");
    
}

const currencyParser = {
  GBP: {
    pounds(amount) {
      return amount === 1 ? "pound" : "pounds";
    },
    pence(amount) {
      return "pence";
    }
  }
};

const dateFormatter = (date) => {
  const options = { weekday: 'long', month: 'long', day: 'numeric' };
  return new Date(date).toLocaleDateString('en-GB', options);
}
