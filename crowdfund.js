//Crowd fund 
const bsv = require('bsv');
const http = require('superagent');
const pk = new bsv.PrivateKey('KyvKDDPmQ4st2o3CHVzFyWsCTSY3EmFZfFcZSbocxkNsPPFU7hgM')
const publicKey = pk.publicKey;

async function getUtxos (address) {
  const url = `https://api.whatsonchain.com/v1/bsv/main/address/${address.toString()}/unspent`
  let utxos  = (await http.get(url)).body;
  return utxos.map((utxo) => {
    return new bsv.Transaction.UnspentOutput({
      address: address,
      txId: utxo.tx_hash,
      outputIndex: utxo.tx_pos,
      amount: utxo.value/1e8,
      script: new bsv.Script(address).toHex(),
    })
  })
};


//creates a transaction with a fixed output and allows inputs to be added
function createCrowdFund(outputs){
  const tx = new bsv.Transaction();
  outputs.map((output) => {
    tx.to(output.address, output.amount);
  })
  return tx;
}

async function addInputsToCrowdFund(crowdFund, privateKey){
  const sigHashType = bsv.crypto.Signature.SIGHASH_ALL | bsv.crypto.Signature.SIGHASH_ANYONECANPAY | bsv.crypto.Signature.SIGHASH_FORKID
  console.log( privateKey.publicKey.toAddress().toString())
  let utxos = await getUtxos(privateKey.publicKey.toAddress()); 
  let amount = 0;
  utxos.map((utxo) => {
    crowdFund.from(utxo)
    amount += utxo.satoshis
  });
  let signatures = crowdFund.getSignatures(pk, sigHashType);
 
  signatures.map((sig) => {
    crowdFund.applySignature(sig);
  })
  return crowdFund;

}

async function broadcast(txhex){
  return (await http.post('https://api.whatsonchain.com/v1/bsv/main/tx/raw').send({txhex})).body
}

//CrowdFund Demo
//Demo txid: 2b02aec0f8f62ecb28efae230b84f4d7fa11262926e291c385d43b0056e5fea0
(async () => {
 
  const outputs = [{
    address: pk.publicKey.toAddress().toString(),
    amount: 0.0001*1e8,
  }]
  let crowdFund = createCrowdFund(outputs)  
  crowdFund = await addInputsToCrowdFund(crowdFund, pk)
  const result = await broadcast(crowdFund.serialize())
  console.log(result)
  
})()


