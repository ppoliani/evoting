var crypto = require('crypto')
var BigInteger = require('bigi') //npm install --save bigi@1.4.2
var ecurve = require('ecurve') //npm install --save ecurve@1.0.0
var cs = require('coinstring') //npm install --save coinstring@2.0.0
var forge = require('node-forge')


function random(bytes){
    do {
        var k = BigInteger.fromByteArrayUnsigned(crypto.randomBytes(bytes));
    } while (k.toString() == "0" && k.gcd(n).toString() != "1")
    return k;
}


/*
function random(bytes){
    do {
        var k = BigInteger.fromByteArrayUnsigned(crypto.randomBytes(bytes));
    } while (k.toString() != "2")
    return k;
}
*/

function isOnCurve (x,y) {

    var x = x;
    var y = y;
    var a = ecurve.getCurveByName('secp256k1').a;
    var b = ecurve.getCurveByName('secp256k1').b;
    var p = ecurve.getCurveByName('secp256k1').p;

    // Check that xQ and yQ are integers in the interval [0, p - 1]
    if (x.signum() < 0 || x.compareTo(p) >= 0) return false
    if (y.signum() < 0 || y.compareTo(p) >= 0) return false

    // and check that y^2 = x^3 + ax + b (mod p)
    var lhs = y.square().mod(p);
    var rhs = x.pow(3).add(a.multiply(x)).add(b).mod(p);
    return lhs.equals(rhs);
}

function multiply(inp,k){
    var str = inp.multiply(k).toString().replace("(","").replace(")","");
    var arr = str.split(",").map(val => String(val));
    arr [0] = BigInteger.fromBuffer(arr[0]);
    arr [1] = BigInteger.fromBuffer(arr[1]);

    return ecurve.Point.fromAffine(ecparams,arr[0],arr[1]);
}

function add(inp,k){
    var str = inp.add(k).toString().replace("(","").replace(")","");
    var arr = str.split(",").map(val => String(val));
    arr [0] = BigInteger.fromBuffer(arr[0]);
    arr [1] = BigInteger.fromBuffer(arr[1]);

    return ecurve.Point.fromAffine(ecparams,arr[0],arr[1]);
}

function toHex(inp){
    return BigInteger.fromBuffer(inp.toString(),"hex").toHex();
}

function keccak256(inp){
    var md = forge.md.sha256.create();
    md.update(inp.toString());
    return md.digest().toHex();
}

var privateKey = new Buffer("1184cd2cdd640ca42cfc3a091c51d549b2f016d454b2774019c2b2d2e08529fd", 'hex')

var m  = "69";

var ecparams = ecurve.getCurveByName('secp256k1');
var curvePt = ecparams.G.multiply(BigInteger.fromBuffer(privateKey));
var x = curvePt.affineX.toBuffer(32);
var y = curvePt.affineY.toBuffer(32);

var G = ecparams.G;
var n = ecparams.n;

console.log(ecparams.G.x.toHex())
console.log(BigInteger.fromBuffer(y).toHex())

/* STEP 1
The signer randomly selects an integer k ∈ Zn
, calculates R = kG, and then transmits R to the
requester
*/

k = random(32);

var R = multiply(G,k);



/*
7d152c041ea8e1dc2191843d1fa9db55b68f88fef695e2c791d40444b365afc2
56915849f52cc8f76f5fd7e4bf60db4a43bf633e1b1383f85fe89164bfadcbdb
9075b4ee4d4788cabb49f7f81c221151fa2f68914d0aa833388fa11ff621a970
*/

var zwei = BigInteger.fromBuffer(new Buffer("2"));
var drei = BigInteger.fromBuffer(new Buffer("3"));

var z = BigInteger.fromBuffer(new Buffer("9075b4ee4d4788cabb49f7f81c221151fa2f68914d0aa833388fa11ff621a970", 'hex'));
var zSquare = (z.pow(2).mod(ecparams.p))
var zCube = (z.pow(3).mod(ecparams.p)) // =112386024462437979217642839804619380985487717678471186887195924032703633398313

/* EZT KELLENE KAPNI
7d152c041ea8e1dc2191843d1fa9db55b68f88fef695e2c791d40444b365afc2
56915849f52cc8f76f5fd7e4bf60db4a43bf633e1b1383f85fe89164bfadcbdb
9075b4ee4d4788cabb49f7f81c221151fa2f68914d0aa833388fa11ff621a970

    uint zInv = invmod(PJ[2], prime);
    uint zInv2 = mulmod(zInv, zInv, prime);
    PJ[0] = mulmod(PJ[0], zInv2, prime);
    PJ[1] = mulmod(PJ[1], mulmod(zInv, zInv2, prime), prime);
    PJ[2] = 1;
*/


//console.log((R.x.multiply(z.modInverse(ecparams.p)).mod(ecparams.p).toHex()));


/* STEP 2
The requester randomly selects two integers γ and δ ∈ Zn, blinds the message, and then
calculates point A = kG + γG + δP = (x, y), t = x (mod n). If t equals zero, then γ and δ should
be reselected. The requester calculates c = SHA256 (m || t), c’ = c − δ, where SHA256 is a
novel hash function computed with 32-bit words and c’ is the blinded message, and then sends
c’ to the signer.
*/

var γ = random(32);

var δ = random(32);

var A = add(add(R,multiply(G,γ)),multiply(curvePt,δ));

var t = A.x.mod(n).toString();

var c = BigInteger.fromHex(keccak256(m+t.toString()));

console.log(keccak256(m+t.toString()));

var cBlinded = c.subtract(δ);

/* STEP 3
The signer calculates the blind signature s’ = k − c’d, and then sends it to the requester.
*/

var sBlind = k.subtract(cBlinded.multiply(BigInteger.fromBuffer(privateKey)));

/* STEP 4
The requester calculates s = s’ + γ, and (c, s) is the signature on m.
*/

var s = sBlind.add(γ);

console.log(s.mod(n).toString())

/* STEP 5
Both the requester and signer can verify the signature (c, s) through the formation
c = SHA256(m || Rx(cP + sG) mod n)
*/

var toHash = add(multiply(curvePt,c.mod(n)),multiply(ecparams.G,s.mod(n))).x.mod(n)
/*
console.log(keccak256(m+toHash));

console.log("Generator point: ", G.toString())
console.log("Doubling the generatorPoint", multiply(G,BigInteger.fromBuffer(new Buffer("02", 'hex'))).toString())
console.log("Doubling with self-addition",add(G,G).toString())
*/

