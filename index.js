const bsv = require('bsv');
const http = require('superagent');
const Minercraft = require('minercraft');
/*
const miner = new Minercraft({
  "url": "https://merchantapi.taal.com"
});
*/
const miner = new Minercraft({
  url: "https://www.ddpurse.com/openapi",
  headers: {
    // The following token value is a "free trial" value. For more info visit https://developers.dotwallet.com/en/dev/api/merchant
    token: "561b756d12572020ea9a104c3441b71790acbbce95a6ddbf7e0630971af9424b"
  }
})

const feeAmount = 800;
const pk = new bsv.PrivateKey('KyvKDDPmQ4st2o3CHVzFyWsCTSY3EmFZfFcZSbocxkNsPPFU7hgM')
const publicKey = pk.publicKey;
const address  = publicKey.toAddress();

 
async function getUtxos (txid, address) {
  let tx = (await http.get(`https://api.whatsonchain.com/v1/bsv/main/tx/hash/${txid}`)).body;
  return tx.vout.map((out) => {
    if( out.scriptPubKey.addresses ){
      return new bsv.Transaction.UnspentOutput({
        address: out.scriptPubKey.addresses[0],
        txId: txid,
        outputIndex: out.n,
        script: out.scriptPubKey.hex,
        amount: out.value, 
      })
    }
  }).filter((output) => output).filter((output) => output.address.toString() === address.toString());
}

function getFee(tx){
  let fee = miner.fee.get({
    rate: { data: 0.5, standard: 0.5 },
    tx: tx.toString()
  });
  return fee;
}

async function broadcast(txhex){
  return (await http.post('https://api.whatsonchain.com/v1/bsv/main/tx/raw').send({txhex})).body
}

//Crowd fund 
//creates a transaction with a fixed output and allows inputs to be added
function createCrowdFund(outputs){
  const tx = new bsv.Transaction();
  outputs.map((output) => {
    tx.to(output.address, output.amount);
  })
  return tx;
}

async function addInputToCrowdFund(crowdFund, inputTxid, privateKey){
  const sigHashType = bsv.crypto.Signature.SIGHASH_ALL | bsv.crypto.Signature.SIGHASH_ANYONECANPAY | bsv.crypto.Signature.SIGHASH_FORKID
  let utxos = await getUtxos(inputTxid, address); 
  let amount = 0;
  utxos.map((utxo) => {
    crowdFund.from(utxo)
    amount += utxo.satoshis
  });
  let sig = crowdFund.getSignatures(pk, sigHashType);
  crowdFund.applySignature(sig[0])
  return crowdFund;

}

//CrowdFund Demo
//Demo txid: 2b02aec0f8f62ecb28efae230b84f4d7fa11262926e291c385d43b0056e5fea0
(async () => {
 
  const outputs = [{
    address: '1JAZgrNxzJ41qyWexWAkDBufwsHpYX2MPC',
    amount: 0.0001*1e8 - 800,
  }]
  let crowdFund = createCrowdFund(outputs)  
  crowdFund = await addInputToCrowdFund(crowdFund, 'a3fe0db1f909027c952ad7006299ef6c8aa06d0a1bf7fa711fe26544bcc7974d', pk)
  console.log(await broadcastMapi(crowdFund.serialize()))
  
})()


//Blank Check 
//returns a transaction with signed inputs and no outputs
//outputs can be added without transaction being invalidated 
async function blankCheck(inputTxid){
  const sigHashType = bsv.crypto.Signature.SIGHASH_NONE | bsv.crypto.Signature.SIGHASH_FORKID
  let utxos = await getUtxos(inputTxid, address); 
  let tx = new bsv.Transaction();
  let amount = 0;
  utxos.map((utxo) => {
    tx.from(utxo)
    amount += utxo.satoshis
  });
  let sig = tx.getSignatures(pk, sigHashType);
  tx.applySignature(sig[0])
  return tx;
}



//Blank Check Demo
//txid: 6351a648973c28d91a9373d75f6b6b14d0930865b7e19254dff4186b01cf7aed
/*
(async () => {
  let check = await blankCheck("6fc3caf36d4086224ee10fbe4b0a054664f2ea65e13181eb127f180e762ad9a6");
  total = check.inputs[0].output.satoshis
  check.to(address, 0.0001*1e8 - 600);
  console.log(await broadcast(check.serialize()))
})()
*/

async function addToTransaction(tx,output, txid, pk, senderAddress){
  const sigHashType = bsv.crypto.Signature.SIGHASH_SINGLE | bsv.crypto.Signature.SIGHASH_ANYONECANPAY | bsv.crypto.Signature.SIGHASH_FORKID
  let utxos = await getUtxos(txid, senderAddress); 
  let amount = 0;
  utxos.map((utxo) => {
    tx.from(utxo)
    amount += utxo.satoshis
  });
  tx.to(output.address, output.amount);
  let sig = tx.getSignatures(pk, sigHashType);
  tx.applySignature(sig[0])
  return tx;
}


//Modular Transaction Demo 
//Allows sender 1 to add their input/output to pass tx to sender 2 and then they add their input/output
//
/*
(async () => {

  const output = {
    address: "18SrToJeVoQ4BSo6DqnvxyPcNUbytRS3bW",
    amount: 0.0001*1e8 - 500,
  }

  let tx = new bsv.Transaction();
  const pk1 = new bsv.PrivateKey('KyvKDDPmQ4st2o3CHVzFyWsCTSY3EmFZfFcZSbocxkNsPPFU7hgM')
  const publicKey1 = pk1.publicKey;
  const sender1 = publicKey1.toAddress();
  const txid1 = 'cd777af784608a81bb9db1254bcaca2772fc76d31ddf1caee60f48f49900cd2d';
  tx = await addToTransaction(tx, output, txid1, pk1, sender1); 

//  const pk2 = new bsv.PrivateKey('KxR6aBeCX7HcPHV7iS79KiANQC9ZjHcNdHxnay8sYBezU4S8B9EV');
//  const sender2 = pk2.publicKey.toAddress().toString()
//  const txid2 = '5fd35857109394a4edcd6c39a9a77a71f2c9d0281d9b7c452c6b1e2e0c4e0a9f';
//  tx = await addToTransaction(tx, output, txid2, pk2, sender2); 
  
   const rawTx = tx.serialize()
  console.log(rawTx)
   const result = await broadcastMapi(rawTx);
   console.log(result)
  // Demo result:
  // 3e265edfe28502c18fa58292f9e0841ffef1321dc5a1d88a1dc8abe71bb318c6
})()
*/
async function broadcastMapi(tx){
  return await miner.tx.push(tx);
}
