Toggle Navigation Menu
Toggle theme
Open User Button Menu



Courses
Introduction to Stacks
Project: Build a token streaming protocol

Stacks
25 min read
·
2 years ago
+10,000 XP
65
65
11
Project: Build a token streaming protocol
Lesson Objectives
Learn how to set up a local Clarinet developer environment
Learn what a token streaming protocol is and why it is used
Build your own token streaming protocol using STX token as method of payment
Learn how to write tests for Clarity smart contracts
Build a comprehensive test suite for your smart contracts
Introduction
Welcome back to the Stacks Developer Degree! In the final lesson for this introductory course - we're going to build our own DeFi protocol using Clarity. Specifically, we will build a token-streaming protocol.
A token streaming protocol is basically a way of establishing a continuous payment stream between two parties - a sender and a recipient. The sender starts by creating a stream that defines the time period, the amount of tokens to pay per-block to the recipient, and who the recipient is. The recipient can then, at his will, withdraw whatever he is owed at any point up until the end of the time period.
This kind of protocol is commonly used in two scenarios:
Freelance work being done for a client, in which case the client can create a stream to pay you over time instead of lump-sum.
Grants being given out to projects, in which case the granting organization can create a token stream to the project team to pay them out over-time.
Without further ado, let's get started!
The full code for this project can be found at this GitHub repo if you'd like to reference it - https://github.com/LearnWeb3DAO/stacks-token-streaming
Design Overview
Before we start writing code, let's spend a few minutes planning out a high level design of how a system like this can work. There are a few key functionalities we need to implement:
Anyone must be able to create a new stream
The creator of a stream can "refuel" the stream by adding new tokens to be used for ongoing payment
The recipient of a stream can withdraw any pending tokens they've accumulated up until that point
The creator of the stream can withdraw any excess tokens that may have been locked in the stream
There must be a way for the parameters of the stream - such as time range - to be updated but only if both parties provide consent for it
To keep things relatively simple, we'll design this protocol with the assumption that all token streams will use the STX token for payment. As a challenge, you can try and modify the code to work with any SIP-010 token instead, like sBTC.
Anyway - keeping the key functionalities in mind, let's think about what we now need:
We'll have to have some way of keeping track of all streams ever created. We can do this by having a mapping in the contract storage.
We must be able to transfer STX tokens from users to the contract, and from contract to the users, depending on the function being called
For being able to update details, since a transaction can only be initiated by one user at a time, to make sure we have consent from the second user we must require them to sign some sort of message and verify their signature onchain to make sure they've given consent
Point (3) is likely the most tricky here - but we'll address it in a bit.
With this design in mind, let's just get started!
Setting up the developer environment
Let's start off by setting up a local developer environment for writing this code.
The first thing you need to do is install Clarinet - a toolkit for writing, testing, and deploying Clarity smart contracts. To see how to install Clarinet for your operating system - follow the installation guide here - https://docs.hiro.so/clarinet/getting-started
Once Clarinet is installed, open up your terminal and navigate to a directory where you want to initialize this project. Then, in your terminal, type:
clarinet new stacks-token-streaming
This will create a new directory named stacks-token-streaming and create some boilerplate code inside it. The project gets set up as a Node.js project - since tests are run using vitest.
So - at this point - make sure you also have Node.js installed. If not, follow instructions at https://nodejs.org/en/download to install it for your operating system.
With the boilerplate set up and Node.js installed, open up the stacks-token-streaming directory in a code editor of your choice, and let's install the npm dependencies by running the following in your terminal (while inside the project directory):
npm install
This will install all the required dependencies.
Finally - if you are using VSCode - I would also highly recommend installing the Clarity Extension for VSCode which will give you syntax highlighting, autocomplete, intellisense, and many other helpful features.
With all this done, we are now ready to start writing our contract! In your terminal, type the following to initialize a new empty contract named stream:
clarinet contract new stream
This will create an empty stream.clar file under the contracts/ directory, and also update the Clarinet.toml configuration file with appropriate values.
Building the Contract
Alright, let's head on over to stream.clar and start writing some code.
Storage
To start off, let's define all our storage values - constants, variables, and a map to store all streams.
;; error codes (define-constant ERR_UNAUTHORIZED (err u0)) (define-constant ERR_INVALID_SIGNATURE (err u1)) (define-constant ERR_STREAM_STILL_ACTIVE (err u2)) (define-constant ERR_INVALID_STREAM_ID (err u3)) ;; data vars (define-data-var latest-stream-id uint u0) ;; streams mapping (define-map streams uint ;; stream-id { sender: principal, recipient: principal, balance: uint, withdrawn-balance: uint, payment-per-block: uint, timeframe: (tuple (start-block uint) (stop-block uint)) } )
We first defined four error codes - ERR_UNAUTHORIZED, ERR_INVALID_SIGNATURE, ERR_STREAM_STILL_ACTIVE and ERR_INVALID_STREAM_ID. These will be thrown in different points - for example, if someone tries to withdraw money from a stream where they're not the recipient, they will get an unauthorized error. If someone tries to update details of a stream but provide an invalid signature for the consenting party, the invalid signature error will be thrown. And, if the stream creator tries to withdraw tokens not yet withdrawn by the recipient before the final block has been hit, they will get the stream still active error.
Then, we define a variable - latest-stream-id to keep track of the latest stream ID which is initially set to 0
Lastly, we created our streams mapping - which has a uint for the stream-id as a key, and a tuple with various relevant values for the value.
In the streams value tuple, we have:
sender: Creator of the stream who is paying the recipient
recipient: Payee of the stream getting paid by sender
balance: Current STX tokens that are part of the stream's balance
withdrawn-balance: Amount of STX tokens that have already been withdrawn by the recipient
payment-per-block: How many STX tokens to unlock with each passing block
timeframe: Another tuple with two values, start-block and stop-block signifying the range of blocks during which this stream is active
Create Stream
Now, let's write the function for creating a new stream. To do so, the creator must specify the recipient address, the block range, and how much STX tokens to pay out per block. Also, they can send us and lock up some STX tokens right then if they want, or refuel to add STX tokens later.
Since creating a stream requires writing to our storage map, this will be a public function.
;; Create a new stream (define-public (stream-to (recipient principal) (initial-balance uint) (timeframe (tuple (start-block uint) (stop-block uint))) (payment-per-block uint) ) (let ( (stream { sender: contract-caller, recipient: recipient, balance: initial-balance, withdrawn-balance: u0, payment-per-block: payment-per-block, timeframe: timeframe }) (current-stream-id (var-get latest-stream-id)) ) ;; stx-transfer takes in (amount, sender, recipient) arguments ;; for the `recipient` - we do `(as-contract tx-sender)` ;; `as-contract` switches the `tx-sender` variable to be the contract principal ;; inside it's scope ;; so doing `as-contract tx-sender` gives us the contract address itself ;; this is like doing address(this) in Solidity (try! (stx-transfer? initial-balance contract-caller (as-contract tx-sender))) (map-set streams current-stream-id stream) (var-set latest-stream-id (+ current-stream-id u1)) (ok current-stream-id) ) )
NOTE: Notice the (let (…)) blocks in the function code. We did not discuss this in our Introduction to Clarity lesson. These let blocks can be used to define some temporary variables to make the code easier to read inside of functions.
In this function, we take in four arguments from the user - recipient, initial-balance, timeframe, and payment-per-block.
Then, we create a temporary variable representing the stream we wish to create - where we set contract-caller as the sender of this stream, and initially a 0 withdrawn-balance value. We also create a temporary variable current-stream-id which is just the value of our latest-stream-id data variable.
Then, we do four things:
Transfer initial-balance worth of STX from the sender to our own contract
stx-transfer takes in three arguments - amount, sender, and recipient
We want to transfer tokens from the stream creator to the contract, so we set sender = contract-caller
Then, the recipient must be the contract itself, so we need to get our own contract address. We do this using (as-contract tx-sender)
The way this works is as-contract changes the global tx-sender variable to equal the contract address within it's scope - so anything inside the as-contract function will have the tx-sender value equal to the contract principal
So, doing (as-contract tx-sender) gives us the contract principal. This is like doing address(this) in Solidity
Set stream-id:stream mapping in our streams mapping
Increment the latest-stream-id data variable by 1
And return an ok response with the stream id referencing the newly created stream
So far so good? If you have any doubts - feel free to reach out to us in the LearnWeb3 Discord server to ask for help.
Refuel
Now, since a stream may start later in the future - the creator may not want to lock up their STX tokens at the time of creating the stream. Instead, they may want to add those STX tokens later once it's getting close to the beginning of the stream.
For this reason, we'll create a refuel function - allowing the sender of the stream to add additional STX tokens to the stream's balance.
;; Increase the locked STX balance for a stream (define-public (refuel (stream-id uint) (amount uint) ) (let ( (stream (unwrap! (map-get? streams stream-id) ERR_INVALID_STREAM_ID)) ) (asserts! (is-eq contract-caller (get sender stream)) ERR_UNAUTHORIZED) (try! (stx-transfer? amount contract-caller (as-contract tx-sender))) (map-set streams stream-id (merge stream {balance: (+ (get balance stream) amount)}) ) (ok amount) ) )
The refuel function takes two parameters - a stream-id and the amount of STX tokens to refuel with.
First, we use the stream-id to fetch the actual stream tuple from our mapping. We use unwrap-panic here because if the stream-id is invalid, the code will just panic and throw an error, which is what we want.
Then, we take a few steps:
Assert and make sure that the contract-caller is the sender of this stream, otherwise throw an UNAUTHORIZED error.
Then, we transfer amount of STX tokens from the sender to our contract
If that also passes, we update our mapping for the given stream-id to have an updated balance field, equal to the old balance plus the new amount of STX tokens being refuelled. We do this by merging the existing stream tuple with a new tuple that has an updated balance value.
Finally, we return with an ok response and the amount of tokens that were refuelled
Great!
Withdraw
Now, once a stream has been created - the recipient of the stream can withdraw any tokens available to them up until that block, minus any amount they've already withdrawn. For this, we will create a withdraw function that lets them do that.
Before writing the withdraw function though - we will create a helper function called balance-of, which we will use later also in the refund function for the sender to withdraw any excess tokens. The balance-of function will tell us either how many tokens the recipient has available to withdraw, or how many tokens the sender has available to get a refund for. We can make this a read-only function since this doesn't affect any storage variables.
We'll also create another helper - calculate-block-delta - that calculates how many blocks have passed (if any) since the starting block of this stream. This can also be a read-only function.
;; Calculate the number of blocks a stream has been active (define-read-only (calculate-block-delta (timeframe (tuple (start-block uint) (stop-block uint))) ) (let ( (start-block (get start-block timeframe)) (stop-block (get stop-block timeframe)) (delta (if (<= block-height start-block) ;; then u0 ;; else (if (< block-height stop-block) ;; then (- block-height start-block) ;; else (- stop-block start-block) ) ) ) ) delta ) )
For calculate-block-delta, we simply take in a timeframe tuple with start-block and stop-block values. The block delta is calculated as such:
If block-height <= start-block, then the stream is not active yet, so we return 0
Else if, block-height < stop-block, then the stream is active and not ended yet, so we return block-height - start-block
Else, the stream is now over - and we return the full range of stop-block - start-block
Now, we can fetch the withdrawable balance of either the stream sender or recipient through a balance-of helper function:
;; Check balance for a party involved in a stream (define-read-only (balance-of (stream-id uint) (who principal) ) (let ( (stream (unwrap! (map-get? streams stream-id) u0)) (block-delta (calculate-block-delta (get timeframe stream))) (recipient-balance (* block-delta (get payment-per-block stream))) ) (if (is-eq who (get recipient stream)) (- recipient-balance (get withdrawn-balance stream)) (if (is-eq who (get sender stream)) (- (get balance stream) recipient-balance) u0 ) ) ) )
The balance-of function takes in two arguments - the stream-id and an address who.
We first get a reference to the actual stream based on the ID from our mapping. Then, we calculate the current block delta. Based on the block delta, we calculate how much total tokens are withdrawable for the recipient (block delta * payment per block). Then, depending on who we are checking for, we do:
If we are checking the balance of the recipient, that is equal to their total accumulated tokens up until that point minus any tokens they have already withdrawn - so we return recipient-balance - withdrawn-balance
Else if we are checking the balance of the sender, that is equal to the total balance of the stream minus whatever is earmarked for the recipient, so we return balance - recipient-balance
Else, if the address belongs neither to the sender nor the recipient, they have no balance for this given stream - so we return 0.
With these two helpers out of the way, we can create our withdraw function now:
;; Withdraw received tokens (define-public (withdraw (stream-id uint) ) (let ( (stream (unwrap! (map-get? streams stream-id) ERR_INVALID_STREAM_ID)) (balance (balance-of stream-id contract-caller)) ) (asserts! (is-eq contract-caller (get recipient stream)) ERR_UNAUTHORIZED) (map-set streams stream-id (merge stream {withdrawn-balance: (+ (get withdrawn-balance stream) balance)}) ) (try! (as-contract (stx-transfer? balance tx-sender (get recipient stream)))) (ok balance) ) )
The withdraw function takes in a stream-id. Then, we get a reference to the actual stream based on that, and also figure out how much balance from this stream is pending for the contract-caller (which should be the recipient).
We then assert that the contract-caller is the stream recipient, otherwise we throw the UNAUTHORIZED error. Then, we update our mapping to increase the withdrawn-balance based on whatever balance is available for the recipient to withdraw. Then, we transfer balance amount of STX tokens from the contract to the stream recipient, and finally return an ok response with the amount of STX tokens withdrawn.
Can you believe we are more than 50% done with the contract? Just a couple more functions left to go.
Refund
Once a stream is over, it is possible there is extra STX tokens left over in the stream. Either because the sender added too much, or that the stream was updated after creation to reduce the block range or reduce the payment per block.
For that case, we need to create a refund function that allows the sender to withdraw any pending STX token balance from the stream after the stream is no longer active.
;; Withdraw excess locked tokens (define-public (refund (stream-id uint) ) (let ( (stream (unwrap! (map-get? streams stream-id) ERR_INVALID_STREAM_ID)) (balance (balance-of stream-id (get sender stream))) ) (asserts! (is-eq contract-caller (get sender stream)) ERR_UNAUTHORIZED) (asserts! (< (get stop-block (get timeframe stream)) block-height) ERR_STREAM_STILL_ACTIVE) (map-set streams stream-id (merge stream { balance: (- (get balance stream) balance), } )) (try! (as-contract (stx-transfer? balance tx-sender (get sender stream)))) (ok balance) ) )
The refund function takes in a stream-id argument only. We use that to get a reference to the stream tuple from our mapping, and also calculate the balance for the stream sender. Then:
We ensure that contract-caller is the stream sender, otherwise we throw an UNAUTHORIZED error.
We ensure the stream is past its stop-block - otherwise we throw the STREAM_STILL_ACTIVE error.
We update our mapping to reduce the overall balance of the stream to be the previous balance minus whatever amount is being withdrawn
Then, we do a STX token transfer from our contract to the stream sender
Finally, we return an ok response with the amount of STX refunded
Awesome - making good progress!
Update Details
Finally, we need one last function to update details of the stream after its creation. But, to avoid malicious behaviour, we must ensure that both the sender and the recipient have consented to doing so.
Since a transaction can only be initiated by one of those, we will design the system in a way where the other user can simply provide a signature to whoever is going to be executing the transaction. We will also design the signature in a way to prevent replay attacks i.e. being able to re-use that signature over-and-over again to maliciously update the stream beyond what the original signature was intended for.
So, let's think about the signature for a second. Let's assume, for simplicity, the recipient is the one executing the actual transaction - so it needs a signature from the sender.
Within the signature, for the contract to be assured the signature provides consent, we will ask the sender to sign over a message that includes the entire stream details prior to the update, as well as the values for payment-per-block and timeframe that will be updated.
But signatures are not signed over arbitrary length data - they are signed over fixed length data. Therefore, we will first create a helper function hash-stream which will create a fixed-length SHA-256 hash over stream and the potentially updated values for the sender to sign over.
;; Get hash of stream (define-read-only (hash-stream (stream-id uint) (new-payment-per-block uint) (new-timeframe (tuple (start-block uint) (stop-block uint))) ) (let ( (stream (unwrap! (map-get? streams stream-id) (sha256 0))) (msg (concat (concat (unwrap-panic (to-consensus-buff? stream)) (unwrap-panic (to-consensus-buff? new-payment-per-block))) (unwrap-panic (to-consensus-buff? new-timeframe)))) ) (sha256 msg) ) )
The hash-stream function takes in a stream-id, a new-payment-per-block, and a new-timeframe tuple. It gets a reference to the stream from the mapping, and then:
Convert the stream tuple into a Buffer using the built-in to-consensus-buff? function which converts any value into a buffer
Convert the new-payment-per-block to a Buffer
Concatenate the above two, convert new-timeframe to a Buffer, and concatenate it as well
Concatenate the three buffers to produce a temporary variable named msg
Do a SHA-256 hash over msg and return that
Once the sender signs this message with their wallet, they will produce a signature. Signatures signed by Stacks wallets are 65 bytes long - and can be verified onchain. To do that verification, we will create another helper function:
;; Signature verification (define-read-only (validate-signature (hash (buff 32)) (signature (buff 65)) (signer principal)) (is-eq (principal-of? (unwrap! (secp256k1-recover? hash signature) false)) (ok signer) ) )
The validate-signature function takes in three arguments - the hash that was signed on, the resulting signature, and the expected signer address. Then:
Uses secp256k1-recover function to extract the public key that signed the hash if signature is valid. This function returns a response type ok or err
We use unwrap! to either access the inner public key value if signature was valid, or return false otherwise
If valid, we use principal-of? to get the address of the wallet associated with the public key
Then we check if the address is equal to the expected signer address. If yes, we return true - otherwise it will return false
With this in place - when it's time to update the details, the sender can use hash-stream to get the hash, sign it with their wallet, and send the signature to the recipient. The recipient can then call the update-details function (we will write it), which will then verify the second-party signature and do the required changes on the stream if valid.
So, let's write the update-details function:
;; Update stream configuration (define-public (update-details (stream-id uint) (payment-per-block uint) (timeframe (tuple (start-block uint) (stop-block uint))) (signer principal) (signature (buff 65)) ) (let ( (stream (unwrap! (map-get? streams stream-id) ERR_INVALID_STREAM_ID)) ) (asserts! (validate-signature (hash-stream stream-id payment-per-block timeframe) signature signer) ERR_INVALID_SIGNATURE) (asserts! (or (and (is-eq (get sender stream) contract-caller) (is-eq (get recipient stream) signer)) (and (is-eq (get sender stream) signer) (is-eq (get recipient stream) contract-caller)) ) ERR_UNAUTHORIZED ) (map-set streams stream-id (merge stream { payment-per-block: payment-per-block, timeframe: timeframe })) (ok true) ) )
This function takes in five arguments - the stream-id, a new payment-per-block value, a new timeframe tuple, the principal address of the signer (counterparty), and the signature done by the counterparty.
It uses the stream-id to get a reference to the actual stream tuple from the mapping. Then:
Ensures the signature is valid and was done by the provided signer principal address
Ensures that one of the following is true:
contract-caller is sender and signer is recipient
OR, contract-caller is recipient and signer is sender
If neither of the above are true, throw an UNAUTHORIZED error
Update the mapping with the new payment-per-block and timeframe settings
Return with a response ok and true
Amazing - we are done with the contract!
Testing
The last thing left for us to do is write some tests and make sure our contract works as expected.
Clarinet's testing framework is built using vitest. If you haven't heard of or used vitest before - it's a popular testing library used within the JavaScript ecosystem.
When we set up our contract, Clarinet already created a dummy test file for us under the test/ directory - look for a file named stream.test.ts over there.
Replace all the contents of that test file with the following:
import { Cl, createStacksPrivateKey, cvToValue, signMessageHashRsv, } from "@stacks/transactions"; import { beforeEach, describe, expect, it } from "vitest"; // `simnet` is a "simulation network" - a local, testing Stacks node for running our tests const accounts = simnet.getAccounts(); // The identifiers of these wallets can be found in the `settings/Devnet.toml` config file // You can also change the identifiers of these wallets in those files if you want const sender = accounts.get("wallet_1")!; const recipient = accounts.get("wallet_2")!; const randomUser = accounts.get("wallet_3")!; describe("test token streaming contract", () => { // Before each test is run, we want to create a stream // so we can run tests around different possible things to do with the stream beforeEach(() => { const result = simnet.callPublicFn( "stream", "stream-to", [ Cl.principal(recipient), Cl.uint(5), Cl.tuple({ "start-block": Cl.uint(0), "stop-block": Cl.uint(5) }), Cl.uint(1), ], sender ); expect(result.events[0].event).toBe("stx_transfer_event"); expect(result.events[0].data.amount).toBe("5"); expect(result.events[0].data.sender).toBe(sender); }); it("ensures contract is initialized properly and stream is created", () => { const latestStreamId = simnet.getDataVar("stream", "latest-stream-id"); expect(latestStreamId).toBeUint(1); const createdStream = simnet.getMapEntry("stream", "streams", Cl.uint(0)); expect(createdStream).toBeSome( Cl.tuple({ sender: Cl.principal(sender), recipient: Cl.principal(recipient), balance: Cl.uint(5), "withdrawn-balance": Cl.uint(0), "payment-per-block": Cl.uint(1), timeframe: Cl.tuple({ "start-block": Cl.uint(0), "stop-block": Cl.uint(5), }), }) ); }); it("ensures stream can be refueled", () => { const result = simnet.callPublicFn( "stream", "refuel", [Cl.uint(0), Cl.uint(5)], sender ); expect(result.events[0].event).toBe("stx_transfer_event"); expect(result.events[0].data.amount).toBe("5"); expect(result.events[0].data.sender).toBe(sender); const createdStream = simnet.getMapEntry("stream", "streams", Cl.uint(0)); expect(createdStream).toBeSome( Cl.tuple({ sender: Cl.principal(sender), recipient: Cl.principal(recipient), balance: Cl.uint(10), "withdrawn-balance": Cl.uint(0), "payment-per-block": Cl.uint(1), timeframe: Cl.tuple({ "start-block": Cl.uint(0), "stop-block": Cl.uint(5), }), }) ); }); it("ensures stream cannot be refueled by random address", () => { const result = simnet.callPublicFn( "stream", "refuel", [Cl.uint(0), Cl.uint(5)], randomUser ); expect(result.result).toBeErr(Cl.uint(0)); }); it("ensures recipient can withdraw tokens over time", () => { // Block 1 was used to deploy contract // Block 2 was used to create stream // `withdraw` will be called in Block 3 // so expected to withdraw (Block 3 - Start_Block) = (3 - 0) tokens const withdraw = simnet.callPublicFn( "stream", "withdraw", [Cl.uint(0)], recipient ); expect(withdraw.events[0].event).toBe("stx_transfer_event"); expect(withdraw.events[0].data.amount).toBe("3"); expect(withdraw.events[0].data.recipient).toBe(recipient); }); it("ensures non-recipient cannot withdraw tokens from stream", () => { const withdraw = simnet.callPublicFn( "stream", "withdraw", [Cl.uint(0)], randomUser ); expect(withdraw.result).toBeErr(Cl.uint(0)); }); it("ensures sender can withdraw excess tokens", () => { // Block 3 simnet.callPublicFn("stream", "refuel", [Cl.uint(0), Cl.uint(5)], sender); // Block 4 and 5 simnet.mineEmptyBlock(); simnet.mineEmptyBlock(); // Claim tokens simnet.callPublicFn("stream", "withdraw", [Cl.uint(0)], recipient); // Withdraw excess const refund = simnet.callPublicFn( "stream", "refund", [Cl.uint(0)], sender ); expect(refund.events[0].event).toBe("stx_transfer_event"); expect(refund.events[0].data.amount).toBe("5"); expect(refund.events[0].data.recipient).toBe(sender); }); it("signature verification can be done on stream hashes", () => { const hashedStream0 = simnet.callReadOnlyFn( "stream", "hash-stream", [ Cl.uint(0), Cl.uint(0), Cl.tuple({ "start-block": Cl.uint(1), "stop-block": Cl.uint(2) }), ], sender ); const hashAsHex = Buffer.from(hashedStream0.result.buffer).toString("hex"); const signature = signMessageHashRsv({ messageHash: hashAsHex, privateKey: createStacksPrivateKey( "7287ba251d44a4d3fd9276c88ce34c5c52a038955511cccaf77e61068649c17801" ), }); const verifySignature = simnet.callReadOnlyFn( "stream", "validate-signature", [ Cl.buffer(hashedStream0.result.buffer), Cl.bufferFromHex(signature.data), Cl.principal(sender), ], sender ); expect(cvToValue(verifySignature.result)).toBe(true); }); it("ensures timeframe and payment per block can be modified with consent of both parties", () => { const hashedStream0 = simnet.callReadOnlyFn( "stream", "hash-stream", [ Cl.uint(0), Cl.uint(1), Cl.tuple({ "start-block": Cl.uint(0), "stop-block": Cl.uint(4) }), ], sender ); const hashAsHex = Buffer.from(hashedStream0.result.buffer).toString("hex"); const senderSignature = signMessageHashRsv({ messageHash: hashAsHex, // This private key is for the `sender` wallet - i.e. `wallet_1` // This can be found in the `settings/Devnet.toml` config file privateKey: createStacksPrivateKey( "7287ba251d44a4d3fd9276c88ce34c5c52a038955511cccaf77e61068649c17801" ), }); simnet.callPublicFn( "stream", "update-details", [ Cl.uint(0), Cl.uint(1), Cl.tuple({ "start-block": Cl.uint(0), "stop-block": Cl.uint(4) }), Cl.principal(sender), Cl.bufferFromHex(senderSignature.data), ], recipient ); const updatedStream = simnet.getMapEntry("stream", "streams", Cl.uint(0)); expect(updatedStream).toBeSome( Cl.tuple({ sender: Cl.principal(sender), recipient: Cl.principal(recipient), balance: Cl.uint(5), "withdrawn-balance": Cl.uint(0), "payment-per-block": Cl.uint(1), timeframe: Cl.tuple({ "start-block": Cl.uint(0), "stop-block": Cl.uint(4), }), }) ); }); });
We won't go into too much detail about each individual test here. I have left a few comments here and there in places where some clarification was necessary. Other than that, if you read through the tests, most of them should be quite self-explanatory.
With the tests in place, run the tests from your terminal by typing:
npm run test
and you should see something like this:

If you see all tests passing like this - congratulations! You've built your own token streaming DeFi protocol using Clarity!
The only thing we haven't done yet is actually deploy our contract to a test network. It's fairly simple, so let's just go over it real quick
Were you able to get your tests to pass?
Yes
No 😞 - I will ask for help in the Discord
Deployment
The first thing you need to be able to deploy to the Stacks Testnet is a Stacks Wallet with some Testnet STX Tokens on it.
If you don't already have a Stacks wallet, download and install Leather Wallet and set up an account.
Once set up, open up the wallet extension, click the hamburger menu in the top-right, and switch network to Testnet.

This is important because Stacks has different wallet addresses on mainnet and testnet - so you must switch the network.
Once you're on testnet, copy your testnet Stacks address and visit the LearnWeb3 Faucet to request some testnet STX tokens.
Once you have testnet STX tokens, export the mnemonic phrase (seed phrase) for your account from the wallet, and put it in settings/Testnet.toml under the accounts.deployer config.
Once that is also done, in your terminal type the following:
clarinet deployments generate --testnet --low-cost
This will create a deployment plan under the deployments/ directory for testnet. Then, to actually deploy your contract, type:
clarinet deployment apply -p deployments/default.testnet-plan.yaml
You should see a prompt asking you to confirm deployment - with information about your contract name, expected transaction fees, and so on.
Confirm the deployment by pressing Y on your keyboard - and shortly after, you should see a success message with your contract address!
Look up your contract on the Stacks Testnet Block Explorer and play around with your contract!
Congratulations - you've now built, tested, and deployed your very own DeFi protocol on Stacks!
Conclusion
With this lesson, we mark the end of the first course of the Stacks Developer Degree. Stay tuned for the next one, which will come in a few short weeks. In that one we'll dig even deeper into Stacks, explore the ecosystem, learn how to build full-stack applications on Stacks, and also learn about some more advanced smart contract techniques.
Until then, ciao - hope you learned some new things - and as always, if you have any questions, hop in to the Discord server and someone will be there to help you out!
Code For STX
As more of you are starting to explore the world of building on Bitcoin, the Stacks Foundation wants to support you in your journey. In addition to numerous free learning opportunities both virtual and in-person, we want there to be an opportunity for you to earn every.single.month.
Get up to $20,000 every month in grants for building on Stacks. Check out Code For STX today and apply!
Project: Build a token streaming protocol
Lesson Objectives
Learn how to set up a local Clarinet developer environment
Learn what a token streaming protocol is and why it is used
Build your own token streaming protocol using STX token as method of payment
Learn how to write tests for Clarity smart contracts
Build a comprehensive test suite for your smart contracts
Introduction
Welcome back to the Stacks Developer Degree! In the final lesson for this introductory course - we're going to build our own DeFi protocol using Clarity. Specifically, we will build a token-streaming protocol.
A token streaming protocol is basically a way of establishing a continuous payment stream between two parties - a sender and a recipient. The sender starts by creating a stream that defines the time period, the amount of tokens to pay per-block to the recipient, and who the recipient is. The recipient can then, at his will, withdraw whatever he is owed at any point up until the end of the time period.
This kind of protocol is commonly used in two scenarios:
Freelance work being done for a client, in which case the client can create a stream to pay you over time instead of lump-sum.
Grants being given out to projects, in which case the granting organization can create a token stream to the project team to pay them out over-time.
Without further ado, let's get started!
The full code for this project can be found at this GitHub repo if you'd like to reference it - https://github.com/LearnWeb3DAO/stacks-token-streaming
Design Overview
Before we start writing code, let's spend a few minutes planning out a high level design of how a system like this can work. There are a few key functionalities we need to implement:
Anyone must be able to create a new stream
The creator of a stream can "refuel" the stream by adding new tokens to be used for ongoing payment
The recipient of a stream can withdraw any pending tokens they've accumulated up until that point
The creator of the stream can withdraw any excess tokens that may have been locked in the stream
There must be a way for the parameters of the stream - such as time range - to be updated but only if both parties provide consent for it
To keep things relatively simple, we'll design this protocol with the assumption that all token streams will use the STX token for payment. As a challenge, you can try and modify the code to work with any SIP-010 token instead, like sBTC.
Anyway - keeping the key functionalities in mind, let's think about what we now need:
We'll have to have some way of keeping track of all streams ever created. We can do this by having a mapping in the contract storage.
We must be able to transfer STX tokens from users to the contract, and from contract to the users, depending on the function being called
For being able to update details, since a transaction can only be initiated by one user at a time, to make sure we have consent from the second user we must require them to sign some sort of message and verify their signature onchain to make sure they've given consent
Point (3) is likely the most tricky here - but we'll address it in a bit.
With this design in mind, let's just get started!
Setting up the developer environment
Let's start off by setting up a local developer environment for writing this code.
The first thing you need to do is install Clarinet - a toolkit for writing, testing, and deploying Clarity smart contracts. To see how to install Clarinet for your operating system - follow the installation guide here - https://docs.hiro.so/clarinet/getting-started
Once Clarinet is installed, open up your terminal and navigate to a directory where you want to initialize this project. Then, in your terminal, type:
clarinet new stacks-token-streaming
This will create a new directory named stacks-token-streaming and create some boilerplate code inside it. The project gets set up as a Node.js project - since tests are run using vitest.
So - at this point - make sure you also have Node.js installed. If not, follow instructions at https://nodejs.org/en/download to install it for your operating system.
With the boilerplate set up and Node.js installed, open up the stacks-token-streaming directory in a code editor of your choice, and let's install the npm dependencies by running the following in your terminal (while inside the project directory):
npm install
This will install all the required dependencies.
Finally - if you are using VSCode - I would also highly recommend installing the Clarity Extension for VSCode which will give you syntax highlighting, autocomplete, intellisense, and many other helpful features.
With all this done, we are now ready to start writing our contract! In your terminal, type the following to initialize a new empty contract named stream:
clarinet contract new stream
This will create an empty stream.clar file under the contracts/ directory, and also update the Clarinet.toml configuration file with appropriate values.
Building the Contract
Alright, let's head on over to stream.clar and start writing some code.
Storage
To start off, let's define all our storage values - constants, variables, and a map to store all streams.
;; error codes (define-constant ERR_UNAUTHORIZED (err u0)) (define-constant ERR_INVALID_SIGNATURE (err u1)) (define-constant ERR_STREAM_STILL_ACTIVE (err u2)) (define-constant ERR_INVALID_STREAM_ID (err u3)) ;; data vars (define-data-var latest-stream-id uint u0) ;; streams mapping (define-map streams uint ;; stream-id { sender: principal, recipient: principal, balance: uint, withdrawn-balance: uint, payment-per-block: uint, timeframe: (tuple (start-block uint) (stop-block uint)) } )
We first defined four error codes - ERR_UNAUTHORIZED, ERR_INVALID_SIGNATURE, ERR_STREAM_STILL_ACTIVE and ERR_INVALID_STREAM_ID. These will be thrown in different points - for example, if someone tries to withdraw money from a stream where they're not the recipient, they will get an unauthorized error. If someone tries to update details of a stream but provide an invalid signature for the consenting party, the invalid signature error will be thrown. And, if the stream creator tries to withdraw tokens not yet withdrawn by the recipient before the final block has been hit, they will get the stream still active error.
Then, we define a variable - latest-stream-id to keep track of the latest stream ID which is initially set to 0
Lastly, we created our streams mapping - which has a uint for the stream-id as a key, and a tuple with various relevant values for the value.
In the streams value tuple, we have:
sender: Creator of the stream who is paying the recipient
recipient: Payee of the stream getting paid by sender
balance: Current STX tokens that are part of the stream's balance
withdrawn-balance: Amount of STX tokens that have already been withdrawn by the recipient
payment-per-block: How many STX tokens to unlock with each passing block
timeframe: Another tuple with two values, start-block and stop-block signifying the range of blocks during which this stream is active
Create Stream
Now, let's write the function for creating a new stream. To do so, the creator must specify the recipient address, the block range, and how much STX tokens to pay out per block. Also, they can send us and lock up some STX tokens right then if they want, or refuel to add STX tokens later.
Since creating a stream requires writing to our storage map, this will be a public function.
;; Create a new stream (define-public (stream-to (recipient principal) (initial-balance uint) (timeframe (tuple (start-block uint) (stop-block uint))) (payment-per-block uint) ) (let ( (stream { sender: contract-caller, recipient: recipient, balance: initial-balance, withdrawn-balance: u0, payment-per-block: payment-per-block, timeframe: timeframe }) (current-stream-id (var-get latest-stream-id)) ) ;; stx-transfer takes in (amount, sender, recipient) arguments ;; for the `recipient` - we do `(as-contract tx-sender)` ;; `as-contract` switches the `tx-sender` variable to be the contract principal ;; inside it's scope ;; so doing `as-contract tx-sender` gives us the contract address itself ;; this is like doing address(this) in Solidity (try! (stx-transfer? initial-balance contract-caller (as-contract tx-sender))) (map-set streams current-stream-id stream) (var-set latest-stream-id (+ current-stream-id u1)) (ok current-stream-id) ) )
NOTE: Notice the (let (…)) blocks in the function code. We did not discuss this in our Introduction to Clarity lesson. These let blocks can be used to define some temporary variables to make the code easier to read inside of functions.
In this function, we take in four arguments from the user - recipient, initial-balance, timeframe, and payment-per-block.
Then, we create a temporary variable representing the stream we wish to create - where we set contract-caller as the sender of this stream, and initially a 0 withdrawn-balance value. We also create a temporary variable current-stream-id which is just the value of our latest-stream-id data variable.
Then, we do four things:
Transfer initial-balance worth of STX from the sender to our own contract
stx-transfer takes in three arguments - amount, sender, and recipient
We want to transfer tokens from the stream creator to the contract, so we set sender = contract-caller
Then, the recipient must be the contract itself, so we need to get our own contract address. We do this using (as-contract tx-sender)
The way this works is as-contract changes the global tx-sender variable to equal the contract address within it's scope - so anything inside the as-contract function will have the tx-sender value equal to the contract principal
So, doing (as-contract tx-sender) gives us the contract principal. This is like doing address(this) in Solidity
Set stream-id:stream mapping in our streams mapping
Increment the latest-stream-id data variable by 1
And return an ok response with the stream id referencing the newly created stream
So far so good? If you have any doubts - feel free to reach out to us in the LearnWeb3 Discord server to ask for help.
Refuel
Now, since a stream may start later in the future - the creator may not want to lock up their STX tokens at the time of creating the stream. Instead, they may want to add those STX tokens later once it's getting close to the beginning of the stream.
For this reason, we'll create a refuel function - allowing the sender of the stream to add additional STX tokens to the stream's balance.
;; Increase the locked STX balance for a stream (define-public (refuel (stream-id uint) (amount uint) ) (let ( (stream (unwrap! (map-get? streams stream-id) ERR_INVALID_STREAM_ID)) ) (asserts! (is-eq contract-caller (get sender stream)) ERR_UNAUTHORIZED) (try! (stx-transfer? amount contract-caller (as-contract tx-sender))) (map-set streams stream-id (merge stream {balance: (+ (get balance stream) amount)}) ) (ok amount) ) )
The refuel function takes two parameters - a stream-id and the amount of STX tokens to refuel with.
First, we use the stream-id to fetch the actual stream tuple from our mapping. We use unwrap-panic here because if the stream-id is invalid, the code will just panic and throw an error, which is what we want.
Then, we take a few steps:
Assert and make sure that the contract-caller is the sender of this stream, otherwise throw an UNAUTHORIZED error.
Then, we transfer amount of STX tokens from the sender to our contract
If that also passes, we update our mapping for the given stream-id to have an updated balance field, equal to the old balance plus the new amount of STX tokens being refuelled. We do this by merging the existing stream tuple with a new tuple that has an updated balance value.
Finally, we return with an ok response and the amount of tokens that were refuelled
Great!
Withdraw
Now, once a stream has been created - the recipient of the stream can withdraw any tokens available to them up until that block, minus any amount they've already withdrawn. For this, we will create a withdraw function that lets them do that.
Before writing the withdraw function though - we will create a helper function called balance-of, which we will use later also in the refund function for the sender to withdraw any excess tokens. The balance-of function will tell us either how many tokens the recipient has available to withdraw, or how many tokens the sender has available to get a refund for. We can make this a read-only function since this doesn't affect any storage variables.
We'll also create another helper - calculate-block-delta - that calculates how many blocks have passed (if any) since the starting block of this stream. This can also be a read-only function.
;; Calculate the number of blocks a stream has been active (define-read-only (calculate-block-delta (timeframe (tuple (start-block uint) (stop-block uint))) ) (let ( (start-block (get start-block timeframe)) (stop-block (get stop-block timeframe)) (delta (if (<= block-height start-block) ;; then u0 ;; else (if (< block-height stop-block) ;; then (- block-height start-block) ;; else (- stop-block start-block) ) ) ) ) delta ) )
For calculate-block-delta, we simply take in a timeframe tuple with start-block and stop-block values. The block delta is calculated as such:
If block-height <= start-block, then the stream is not active yet, so we return 0
Else if, block-height < stop-block, then the stream is active and not ended yet, so we return block-height - start-block
Else, the stream is now over - and we return the full range of stop-block - start-block
Now, we can fetch the withdrawable balance of either the stream sender or recipient through a balance-of helper function:
;; Check balance for a party involved in a stream (define-read-only (balance-of (stream-id uint) (who principal) ) (let ( (stream (unwrap! (map-get? streams stream-id) u0)) (block-delta (calculate-block-delta (get timeframe stream))) (recipient-balance (* block-delta (get payment-per-block stream))) ) (if (is-eq who (get recipient stream)) (- recipient-balance (get withdrawn-balance stream)) (if (is-eq who (get sender stream)) (- (get balance stream) recipient-balance) u0 ) ) ) )
The balance-of function takes in two arguments - the stream-id and an address who.
We first get a reference to the actual stream based on the ID from our mapping. Then, we calculate the current block delta. Based on the block delta, we calculate how much total tokens are withdrawable for the recipient (block delta * payment per block). Then, depending on who we are checking for, we do:
If we are checking the balance of the recipient, that is equal to their total accumulated tokens up until that point minus any tokens they have already withdrawn - so we return recipient-balance - withdrawn-balance
Else if we are checking the balance of the sender, that is equal to the total balance of the stream minus whatever is earmarked for the recipient, so we return balance - recipient-balance
Else, if the address belongs neither to the sender nor the recipient, they have no balance for this given stream - so we return 0.
With these two helpers out of the way, we can create our withdraw function now:
;; Withdraw received tokens (define-public (withdraw (stream-id uint) ) (let ( (stream (unwrap! (map-get? streams stream-id) ERR_INVALID_STREAM_ID)) (balance (balance-of stream-id contract-caller)) ) (asserts! (is-eq contract-caller (get recipient stream)) ERR_UNAUTHORIZED) (map-set streams stream-id (merge stream {withdrawn-balance: (+ (get withdrawn-balance stream) balance)}) ) (try! (as-contract (stx-transfer? balance tx-sender (get recipient stream)))) (ok balance) ) )
The withdraw function takes in a stream-id. Then, we get a reference to the actual stream based on that, and also figure out how much balance from this stream is pending for the contract-caller (which should be the recipient).
We then assert that the contract-caller is the stream recipient, otherwise we throw the UNAUTHORIZED error. Then, we update our mapping to increase the withdrawn-balance based on whatever balance is available for the recipient to withdraw. Then, we transfer balance amount of STX tokens from the contract to the stream recipient, and finally return an ok response with the amount of STX tokens withdrawn.
Can you believe we are more than 50% done with the contract? Just a couple more functions left to go.
Refund
Once a stream is over, it is possible there is extra STX tokens left over in the stream. Either because the sender added too much, or that the stream was updated after creation to reduce the block range or reduce the payment per block.
For that case, we need to create a refund function that allows the sender to withdraw any pending STX token balance from the stream after the stream is no longer active.
;; Withdraw excess locked tokens (define-public (refund (stream-id uint) ) (let ( (stream (unwrap! (map-get? streams stream-id) ERR_INVALID_STREAM_ID)) (balance (balance-of stream-id (get sender stream))) ) (asserts! (is-eq contract-caller (get sender stream)) ERR_UNAUTHORIZED) (asserts! (< (get stop-block (get timeframe stream)) block-height) ERR_STREAM_STILL_ACTIVE) (map-set streams stream-id (merge stream { balance: (- (get balance stream) balance), } )) (try! (as-contract (stx-transfer? balance tx-sender (get sender stream)))) (ok balance) ) )
The refund function takes in a stream-id argument only. We use that to get a reference to the stream tuple from our mapping, and also calculate the balance for the stream sender. Then:
We ensure that contract-caller is the stream sender, otherwise we throw an UNAUTHORIZED error.
We ensure the stream is past its stop-block - otherwise we throw the STREAM_STILL_ACTIVE error.
We update our mapping to reduce the overall balance of the stream to be the previous balance minus whatever amount is being withdrawn
Then, we do a STX token transfer from our contract to the stream sender
Finally, we return an ok response with the amount of STX refunded
Awesome - making good progress!
Update Details
Finally, we need one last function to update details of the stream after its creation. But, to avoid malicious behaviour, we must ensure that both the sender and the recipient have consented to doing so.
Since a transaction can only be initiated by one of those, we will design the system in a way where the other user can simply provide a signature to whoever is going to be executing the transaction. We will also design the signature in a way to prevent replay attacks i.e. being able to re-use that signature over-and-over again to maliciously update the stream beyond what the original signature was intended for.
So, let's think about the signature for a second. Let's assume, for simplicity, the recipient is the one executing the actual transaction - so it needs a signature from the sender.
Within the signature, for the contract to be assured the signature provides consent, we will ask the sender to sign over a message that includes the entire stream details prior to the update, as well as the values for payment-per-block and timeframe that will be updated.
But signatures are not signed over arbitrary length data - they are signed over fixed length data. Therefore, we will first create a helper function hash-stream which will create a fixed-length SHA-256 hash over stream and the potentially updated values for the sender to sign over.
;; Get hash of stream (define-read-only (hash-stream (stream-id uint) (new-payment-per-block uint) (new-timeframe (tuple (start-block uint) (stop-block uint))) ) (let ( (stream (unwrap! (map-get? streams stream-id) (sha256 0))) (msg (concat (concat (unwrap-panic (to-consensus-buff? stream)) (unwrap-panic (to-consensus-buff? new-payment-per-block))) (unwrap-panic (to-consensus-buff? new-timeframe)))) ) (sha256 msg) ) )
The hash-stream function takes in a stream-id, a new-payment-per-block, and a new-timeframe tuple. It gets a reference to the stream from the mapping, and then:
Convert the stream tuple into a Buffer using the built-in to-consensus-buff? function which converts any value into a buffer
Convert the new-payment-per-block to a Buffer
Concatenate the above two, convert new-timeframe to a Buffer, and concatenate it as well
Concatenate the three buffers to produce a temporary variable named msg
Do a SHA-256 hash over msg and return that
Once the sender signs this message with their wallet, they will produce a signature. Signatures signed by Stacks wallets are 65 bytes long - and can be verified onchain. To do that verification, we will create another helper function:
;; Signature verification (define-read-only (validate-signature (hash (buff 32)) (signature (buff 65)) (signer principal)) (is-eq (principal-of? (unwrap! (secp256k1-recover? hash signature) false)) (ok signer) ) )
The validate-signature function takes in three arguments - the hash that was signed on, the resulting signature, and the expected signer address. Then:
Uses secp256k1-recover function to extract the public key that signed the hash if signature is valid. This function returns a response type ok or err
We use unwrap! to either access the inner public key value if signature was valid, or return false otherwise
If valid, we use principal-of? to get the address of the wallet associated with the public key
Then we check if the address is equal to the expected signer address. If yes, we return true - otherwise it will return false
With this in place - when it's time to update the details, the sender can use hash-stream to get the hash, sign it with their wallet, and send the signature to the recipient. The recipient can then call the update-details function (we will write it), which will then verify the second-party signature and do the required changes on the stream if valid.
So, let's write the update-details function:
;; Update stream configuration (define-public (update-details (stream-id uint) (payment-per-block uint) (timeframe (tuple (start-block uint) (stop-block uint))) (signer principal) (signature (buff 65)) ) (let ( (stream (unwrap! (map-get? streams stream-id) ERR_INVALID_STREAM_ID)) ) (asserts! (validate-signature (hash-stream stream-id payment-per-block timeframe) signature signer) ERR_INVALID_SIGNATURE) (asserts! (or (and (is-eq (get sender stream) contract-caller) (is-eq (get recipient stream) signer)) (and (is-eq (get sender stream) signer) (is-eq (get recipient stream) contract-caller)) ) ERR_UNAUTHORIZED ) (map-set streams stream-id (merge stream { payment-per-block: payment-per-block, timeframe: timeframe })) (ok true) ) )
This function takes in five arguments - the stream-id, a new payment-per-block value, a new timeframe tuple, the principal address of the signer (counterparty), and the signature done by the counterparty.
It uses the stream-id to get a reference to the actual stream tuple from the mapping. Then:
Ensures the signature is valid and was done by the provided signer principal address
Ensures that one of the following is true:
contract-caller is sender and signer is recipient
OR, contract-caller is recipient and signer is sender
If neither of the above are true, throw an UNAUTHORIZED error
Update the mapping with the new payment-per-block and timeframe settings
Return with a response ok and true
Amazing - we are done with the contract!
Testing
The last thing left for us to do is write some tests and make sure our contract works as expected.
Clarinet's testing framework is built using vitest. If you haven't heard of or used vitest before - it's a popular testing library used within the JavaScript ecosystem.
When we set up our contract, Clarinet already created a dummy test file for us under the test/ directory - look for a file named stream.test.ts over there.
Replace all the contents of that test file with the following:
import { Cl, createStacksPrivateKey, cvToValue, signMessageHashRsv, } from "@stacks/transactions"; import { beforeEach, describe, expect, it } from "vitest"; // `simnet` is a "simulation network" - a local, testing Stacks node for running our tests const accounts = simnet.getAccounts(); // The identifiers of these wallets can be found in the `settings/Devnet.toml` config file // You can also change the identifiers of these wallets in those files if you want const sender = accounts.get("wallet_1")!; const recipient = accounts.get("wallet_2")!; const randomUser = accounts.get("wallet_3")!; describe("test token streaming contract", () => { // Before each test is run, we want to create a stream // so we can run tests around different possible things to do with the stream beforeEach(() => { const result = simnet.callPublicFn( "stream", "stream-to", [ Cl.principal(recipient), Cl.uint(5), Cl.tuple({ "start-block": Cl.uint(0), "stop-block": Cl.uint(5) }), Cl.uint(1), ], sender ); expect(result.events[0].event).toBe("stx_transfer_event"); expect(result.events[0].data.amount).toBe("5"); expect(result.events[0].data.sender).toBe(sender); }); it("ensures contract is initialized properly and stream is created", () => { const latestStreamId = simnet.getDataVar("stream", "latest-stream-id"); expect(latestStreamId).toBeUint(1); const createdStream = simnet.getMapEntry("stream", "streams", Cl.uint(0)); expect(createdStream).toBeSome( Cl.tuple({ sender: Cl.principal(sender), recipient: Cl.principal(recipient), balance: Cl.uint(5), "withdrawn-balance": Cl.uint(0), "payment-per-block": Cl.uint(1), timeframe: Cl.tuple({ "start-block": Cl.uint(0), "stop-block": Cl.uint(5), }), }) ); }); it("ensures stream can be refueled", () => { const result = simnet.callPublicFn( "stream", "refuel", [Cl.uint(0), Cl.uint(5)], sender ); expect(result.events[0].event).toBe("stx_transfer_event"); expect(result.events[0].data.amount).toBe("5"); expect(result.events[0].data.sender).toBe(sender); const createdStream = simnet.getMapEntry("stream", "streams", Cl.uint(0)); expect(createdStream).toBeSome( Cl.tuple({ sender: Cl.principal(sender), recipient: Cl.principal(recipient), balance: Cl.uint(10), "withdrawn-balance": Cl.uint(0), "payment-per-block": Cl.uint(1), timeframe: Cl.tuple({ "start-block": Cl.uint(0), "stop-block": Cl.uint(5), }), }) ); }); it("ensures stream cannot be refueled by random address", () => { const result = simnet.callPublicFn( "stream", "refuel", [Cl.uint(0), Cl.uint(5)], randomUser ); expect(result.result).toBeErr(Cl.uint(0)); }); it("ensures recipient can withdraw tokens over time", () => { // Block 1 was used to deploy contract // Block 2 was used to create stream // `withdraw` will be called in Block 3 // so expected to withdraw (Block 3 - Start_Block) = (3 - 0) tokens const withdraw = simnet.callPublicFn( "stream", "withdraw", [Cl.uint(0)], recipient ); expect(withdraw.events[0].event).toBe("stx_transfer_event"); expect(withdraw.events[0].data.amount).toBe("3"); expect(withdraw.events[0].data.recipient).toBe(recipient); }); it("ensures non-recipient cannot withdraw tokens from stream", () => { const withdraw = simnet.callPublicFn( "stream", "withdraw", [Cl.uint(0)], randomUser ); expect(withdraw.result).toBeErr(Cl.uint(0)); }); it("ensures sender can withdraw excess tokens", () => { // Block 3 simnet.callPublicFn("stream", "refuel", [Cl.uint(0), Cl.uint(5)], sender); // Block 4 and 5 simnet.mineEmptyBlock(); simnet.mineEmptyBlock(); // Claim tokens simnet.callPublicFn("stream", "withdraw", [Cl.uint(0)], recipient); // Withdraw excess const refund = simnet.callPublicFn( "stream", "refund", [Cl.uint(0)], sender ); expect(refund.events[0].event).toBe("stx_transfer_event"); expect(refund.events[0].data.amount).toBe("5"); expect(refund.events[0].data.recipient).toBe(sender); }); it("signature verification can be done on stream hashes", () => { const hashedStream0 = simnet.callReadOnlyFn( "stream", "hash-stream", [ Cl.uint(0), Cl.uint(0), Cl.tuple({ "start-block": Cl.uint(1), "stop-block": Cl.uint(2) }), ], sender ); const hashAsHex = Buffer.from(hashedStream0.result.buffer).toString("hex"); const signature = signMessageHashRsv({ messageHash: hashAsHex, privateKey: createStacksPrivateKey( "7287ba251d44a4d3fd9276c88ce34c5c52a038955511cccaf77e61068649c17801" ), }); const verifySignature = simnet.callReadOnlyFn( "stream", "validate-signature", [ Cl.buffer(hashedStream0.result.buffer), Cl.bufferFromHex(signature.data), Cl.principal(sender), ], sender ); expect(cvToValue(verifySignature.result)).toBe(true); }); it("ensures timeframe and payment per block can be modified with consent of both parties", () => { const hashedStream0 = simnet.callReadOnlyFn( "stream", "hash-stream", [ Cl.uint(0), Cl.uint(1), Cl.tuple({ "start-block": Cl.uint(0), "stop-block": Cl.uint(4) }), ], sender ); const hashAsHex = Buffer.from(hashedStream0.result.buffer).toString("hex"); const senderSignature = signMessageHashRsv({ messageHash: hashAsHex, // This private key is for the `sender` wallet - i.e. `wallet_1` // This can be found in the `settings/Devnet.toml` config file privateKey: createStacksPrivateKey( "7287ba251d44a4d3fd9276c88ce34c5c52a038955511cccaf77e61068649c17801" ), }); simnet.callPublicFn( "stream", "update-details", [ Cl.uint(0), Cl.uint(1), Cl.tuple({ "start-block": Cl.uint(0), "stop-block": Cl.uint(4) }), Cl.principal(sender), Cl.bufferFromHex(senderSignature.data), ], recipient ); const updatedStream = simnet.getMapEntry("stream", "streams", Cl.uint(0)); expect(updatedStream).toBeSome( Cl.tuple({ sender: Cl.principal(sender), recipient: Cl.principal(recipient), balance: Cl.uint(5), "withdrawn-balance": Cl.uint(0), "payment-per-block": Cl.uint(1), timeframe: Cl.tuple({ "start-block": Cl.uint(0), "stop-block": Cl.uint(4), }), }) ); }); });
We won't go into too much detail about each individual test here. I have left a few comments here and there in places where some clarification was necessary. Other than that, if you read through the tests, most of them should be quite self-explanatory.
With the tests in place, run the tests from your terminal by typing:
npm run test
and you should see something like this:

If you see all tests passing like this - congratulations! You've built your own token streaming DeFi protocol using Clarity!
The only thing we haven't done yet is actually deploy our contract to a test network. It's fairly simple, so let's just go over it real quick
Were you able to get your tests to pass?
Yes
No 😞 - I will ask for help in the Discord
Deployment
The first thing you need to be able to deploy to the Stacks Testnet is a Stacks Wallet with some Testnet STX Tokens on it.
If you don't already have a Stacks wallet, download and install Leather Wallet and set up an account.
Once set up, open up the wallet extension, click the hamburger menu in the top-right, and switch network to Testnet.

This is important because Stacks has different wallet addresses on mainnet and testnet - so you must switch the network.
Once you're on testnet, copy your testnet Stacks address and visit the LearnWeb3 Faucet to request some testnet STX tokens.
Once you have testnet STX tokens, export the mnemonic phrase (seed phrase) for your account from the wallet, and put it in settings/Testnet.toml under the accounts.deployer config.
Once that is also done, in your terminal type the following:
clarinet deployments generate --testnet --low-cost
This will create a deployment plan under the deployments/ directory for testnet. Then, to actually deploy your contract, type:
clarinet deployment apply -p deployments/default.testnet-plan.yaml
You should see a prompt asking you to confirm deployment - with information about your contract name, expected transaction fees, and so on.
Confirm the deployment by pressing Y on your keyboard - and shortly after, you should see a success message with your contract address!
Look up your contract on the Stacks Testnet Block Explorer and play around with your contract!
Congratulations - you've now built, tested, and deployed your very own DeFi protocol on Stacks!
Conclusion
With this lesson, we mark the end of the first course of the Stacks Developer Degree. Stay tuned for the next one, which will come in a few short weeks. In that one we'll dig even deeper into Stacks, explore the ecosystem, learn how to build full-stack applications on Stacks, and also learn about some more advanced smart contract techniques.
Until then, ciao - hope you learned some new things - and as always, if you have any questions, hop in to the Discord server and someone will be there to help you out!
Previous lessonSIP-010 Fungible Tokens & Traits
Suggest Edits
Submit Quiz
65
65
11


Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))