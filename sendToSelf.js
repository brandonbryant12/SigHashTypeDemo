const bsv = require('bsv');
const http = require('superagent');
var fs = require('fs');
const pk = new bsv.PrivateKey('L2zVSKm88cr1BDX1LTtzNhUfAwVyGJfobkWXAz39eVygzQ5mSCvb')
const publicKey = pk.publicKey;
const address  = publicKey.toAddress();
const fee = 500;
const sigHashType = bsv.crypto.Signature.SIGHASH_ALL | bsv.crypto.Signature.SIGHASH_FORKID

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
 

async function broadcast(txhex){
  return (await http.post('https://api.whatsonchain.com/v1/bsv/main/tx/raw').send({txhex})).body
}

( async () => {

  const utxos = await getUtxos(address);
  const total = utxos.reduce((sum, utxo) => sum + utxo.satoshis, 0);
  const tx = new bsv.Transaction();
  utxos.map((utxo) => tx.from(utxo));
  tx.to(address.toString(), total - tx._estimateFee());
  let sigs = tx.getSignatures(pk, sigHashType);
  sigs.map((sig) => tx.applySignature(sig));
  const result = await broadcast(tx.toString());
  console.log('txid', result)

})();
