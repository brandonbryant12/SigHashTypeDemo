const bsv = require('bsv');
const http = require('superagent');
const pk = new bsv.PrivateKey('L2zVSKm88cr1BDX1LTtzNhUfAwVyGJfobkWXAz39eVygzQ5mSCvb')
const publicKey = pk.publicKey;
const address  = publicKey.toAddress();
const sigHashType = bsv.crypto.Signature.SIGHASH_ALL | bsv.crypto.Signature.SIGHASH_FORKID
const reward = 1000;

const scriptPubKey = new bsv.Script.fromASM('OP_4 OP_7 OP_2 OP_PICK OP_1 OP_EQUAL OP_IF OP_3 OP_PICK OP_NOP OP_2 OP_PICK OP_2 OP_PICK OP_1 OP_PICK OP_1 OP_PICK OP_ADD OP_NIP OP_NIP OP_NOP OP_NUMEQUAL OP_NIP OP_NIP OP_NIP OP_NIP OP_ELSE OP_2 OP_PICK OP_2 OP_EQUAL OP_IF OP_3 OP_PICK OP_2 OP_PICK OP_2 OP_PICK OP_SUB OP_NUMEQUAL OP_NIP OP_NIP OP_NIP OP_NIP OP_ELSE OP_0 OP_ENDIF OP_ENDIF'); 

const scriptSig = new bsv.Script.fromASM('OP_11'); 

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

async function getInputsByScriptHash(scriptHash){
  let counter = 0;
  const utxos = (await http.get(`https://api.whatsonchain.com/v1/bsv/main/script/${scriptHash}/unspent`)).body
  return utxos.map((utxo) => {
    return new bsv.Transaction.Input({
      prevTxId: utxo.tx_hash,
      output: new bsv.Transaction.Output({ satoshis: utxo.value, script: scriptPubKey.toHex() }),
      script: scriptPubKey,
      outputIndex: counter++,
    })
  })

}

async function fundAdditionContract(){

  const utxos = await getUtxos(address);
  const total = utxos.reduce((sum, utxo) => sum + utxo.satoshis, 0);
  const tx = new bsv.Transaction();
  utxos.map((utxo) => tx.from(utxo));
  const output = new bsv.Transaction.Output({ satoshis: reward, script: scriptPubKey.toHex()}) 
  tx.addOutput(output)
  tx.to(address.toString(), total - reward - tx._estimateFee());
  let sigs = tx.getSignatures(pk, sigHashType);
  sigs.map((sig) => tx.applySignature(sig));
  const result = await broadcast(tx.toString());
  console.log('txid', result)

}

async function spendAdditionContract(txid){


}

( async () => {
//  await fundAdditionContract()
  //
  const tx = new bsv.Transaction()
  let inputs = await getInputsByScriptHash('0c43548a6a59cbdd9e0d726d6752719a720f09408ec4c305eb385d3774776e4c')
  inputs.map((input) => tx.addInput(input));
  const total = inputs.reduce((sum, input) => sum + input.output.satoshis, 0)
  tx.to(address, total - tx._estimateFee())

  console.log(tx)
 
})();

