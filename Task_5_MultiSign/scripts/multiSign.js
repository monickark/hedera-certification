const {
  Client,
  PrivateKey,
  AccountCreateTransaction,
  TransferTransaction,
  AccountBalanceQuery,
  Hbar,
  KeyList,
  ScheduleInfoQuery,
  ScheduleSignTransaction,
  ScheduleId,
  AccountId,
  Timestamp,
} = require("@hashgraph/sdk");
require("dotenv").config();

//Grab your Hedera testnet account ID and private key from your .env file
const {
  CLIENT_ID,
  CLIENT_PRIVATE_KEY,
  ACCOUNT_1_PRIVATE_KEY,
  ACCOUNT_2_PRIVATE_KEY,
  ACCOUNT_3_PRIVATE_KEY,
  ACCOUNT_5_ID,
} = process.env;

async function main() {
  const client = await getClient();

  console.log(`\n============= Creating Multisig Account =============`);

  //Creating key objects and extracting public keys
  const key1 = PrivateKey.fromString(ACCOUNT_1_PRIVATE_KEY).publicKey;
  const key2 = PrivateKey.fromString(ACCOUNT_2_PRIVATE_KEY).publicKey;
  const key3 = PrivateKey.fromString(ACCOUNT_3_PRIVATE_KEY).publicKey;

  //Creating array of multi sig account owners
  const keys = [key1, key2, key3];

  //Create a key list with 3 keys and require 2 signatures
  const keyList = new KeyList(keys, 2);

  //Create a multi signature account with 20 Hbar starting balance
  const multiSignAcctId = await createMultiSignAccount(keyList);

  //Logging initial balances
  await accountBalance(multiSignAcctId);
  await accountBalance(ACCOUNT_5_ID);

  console.log(
    `\n=============Creating Schedule Multisig transfer =============`
  );

  // Schedule crypto transfer from multi-sig account to account 4 and sign the transaction by Account 1
  const txSchedule = await new TransferTransaction()
    .addHbarTransfer(multiSignAcctId, Hbar.fromTinybars(-2))
    .addHbarTransfer(ACCOUNT_5_ID, Hbar.fromTinybars(2))
    .schedule() // create schedule
    .freezeWith(client)
    .sign(PrivateKey.fromString(ACCOUNT_1_PRIVATE_KEY)); //Signing by the Key

  const txResponse = await txSchedule.execute(client);
  const receipt = await txResponse.getReceipt(client);
  console.log(
    `Creating and executing transaction ${txResponse.transactionId.toString()} status: ${
      receipt.status
    }`
  );

  //Get the schedule ID
  const scheduleId = receipt.scheduleId;
  console.log("The schedule ID is " + scheduleId);

  console.log(`\n=============Printing Scheduled Info =============`);

  await retrieveScheduleInfo(scheduleId);

  console.log(`\n=============Adding the signature by Account 2 =============`);
  // Add Signature by Account 2
  const txScheduleSign2 = await await new ScheduleSignTransaction()
    .setScheduleId(scheduleId)
    .freezeWith(client)
    .sign(PrivateKey.fromString(ACCOUNT_2_PRIVATE_KEY)); // Add Signature 2

  const txResponse2 = await txScheduleSign2.execute(client);
  const receipt2 = await txResponse2.getReceipt(client);
  console.log(
    `Creating and executing transaction ${txResponse2.transactionId.toString()} status: ${
      receipt2.status
    }`
  );

  console.log(`\n============= Schedule Id Info =============`);
  await retrieveScheduleInfo(scheduleId);

  console.log(`\n============= Account Balances for transaction =============`);
  await accountBalance(multiSignAcctId);
  await accountBalance(ACCOUNT_5_ID);

  process.exit();
}

async function getClient() {
  // If we weren't able to grab it, we should throw a new error
  if (CLIENT_ID == null || CLIENT_PRIVATE_KEY == null) {
    throw new Error(
      "Environment variables CLIENT_ID and CLIENT_PRIVATE_KEY must be present"
    );
  }

  // Create our connection to the Hedera network
  return Client.forTestnet().setOperator(CLIENT_ID, CLIENT_PRIVATE_KEY);
}

async function createMultiSignAccount(keys) {
  const client = await getClient();
  const multiSigAccount = await new AccountCreateTransaction()
    .setKey(keys)
    .setInitialBalance(Hbar.fromString("20"))
    .execute(client);

  // Get the new account ID
  const getReceipt = await multiSigAccount.getReceipt(client);
  const multiSignAcctId = getReceipt.accountId;

  console.log("\nThe Multi Signature Account ID is: " + multiSignAcctId);
  return multiSignAcctId;
}

async function accountBalance(accountID) {
  const client = await getClient();
  //Check the account's balance
  const getBalance = await new AccountBalanceQuery()
    .setAccountId(accountID)
    .execute(client);

  console.log(
    `\nBalance of ${accountID}: ` + getBalance.hbars.toTinybars() + " tinybars."
  );
}

async function retrieveScheduleInfo(scheduleId) {
  const client = await getClient();
  //Create the query
  const info = await new ScheduleInfoQuery()
    .setScheduleId(scheduleId)
    .execute(client);

  //Consoling the information
  console.log(
    "================ Scheduled Transaction Info ==================="
  );
  console.log("ScheduleId :", new ScheduleId(info.scheduleId).toString());
  console.log("Memo : ", info.scheduleMemo);
  console.log("Created by : ", new AccountId(info.creatorAccountId).toString());
  console.log("Payed by : ", new AccountId(info.payerAccountId).toString());
  console.log(
    "Expiration time : ",
    new Timestamp(info.expirationTime).toDate()
  );
  if (
    new Timestamp(info.executed).toDate().getTime() ===
    new Date("1970-01-01T00:00:00.000Z").getTime()
  ) {
    console.log("The transaction has not been executed yet.");
  } else {
    console.log("The transaction has been executed.");
    console.log("Time of execution : ", new Timestamp(info.executed).toDate());
  }
}

main();
