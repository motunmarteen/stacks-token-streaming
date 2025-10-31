;; title: stream
;; version: 1.0.0
;; summary: A token streaming protocol for continuous payments
;; description: Allows users to create payment streams where tokens are distributed over time

;; traits
;;

;; token definitions
;;

;; constants
;; error codes
(define-constant ERR_UNAUTHORIZED (err u0))
(define-constant ERR_INVALID_SIGNATURE (err u1))
(define-constant ERR_STREAM_STILL_ACTIVE (err u2))
(define-constant ERR_INVALID_STREAM_ID (err u3))
(define-constant ERR_STREAM_NOT_PAUSED (err u4))
(define-constant ERR_STREAM_ALREADY_PAUSED (err u5))
(define-constant ERR_STREAM_CANCELLED (err u6))

;; stream status constants
(define-constant STATUS_ACTIVE (ok u0))
(define-constant STATUS_PAUSED (ok u1))
(define-constant STATUS_CANCELLED (ok u2))

;; data vars
(define-data-var latest-stream-id uint u0)

;; data maps
;; streams mapping
(define-map streams
  uint ;; stream-id
  {
    sender: principal,
    recipient: principal,
    balance: uint,
    withdrawn-balance: uint,
    payment-per-block: uint,
    timeframe: (tuple (start-block uint) (stop-block uint)),
    status: (response uint uint),
    pause-block: uint,
    total-paused-blocks: uint
  }
)

;; public functions
;; Create a new stream
(define-public (stream-to 
  (recipient principal) 
  (initial-balance uint) 
  (timeframe (tuple (start-block uint) (stop-block uint))) 
  (payment-per-block uint)
)
  (let (
    (stream {
      sender: contract-caller,
      recipient: recipient,
      balance: initial-balance,
      withdrawn-balance: u0,
      payment-per-block: payment-per-block,
      timeframe: timeframe,
      status: STATUS_ACTIVE,
      pause-block: u0,
      total-paused-blocks: u0
    })
    (current-stream-id (var-get latest-stream-id))
  )
    ;; stx-transfer takes in (amount, sender, recipient) arguments
    ;; for the `recipient` - we do `(as-contract tx-sender)`
    ;; `as-contract` switches the `tx-sender` variable to be the contract principal
    ;; inside it's scope
    ;; so doing `as-contract tx-sender` gives us the contract address itself
    ;; this is like doing address(this) in Solidity
    (try! (stx-transfer? initial-balance contract-caller (as-contract tx-sender)))
    (map-set streams current-stream-id stream)
    (var-set latest-stream-id (+ current-stream-id u1))
    (ok current-stream-id)
  )
)

;; Increase the locked STX balance for a stream
(define-public (refuel 
  (stream-id uint) 
  (amount uint)
)
  (let (
    (stream (unwrap! (map-get? streams stream-id) ERR_INVALID_STREAM_ID))
  )
    (asserts! (is-eq contract-caller (get sender stream)) ERR_UNAUTHORIZED)
    (try! (stx-transfer? amount contract-caller (as-contract tx-sender)))
    (map-set streams stream-id (merge stream {balance: (+ (get balance stream) amount)}))
    (ok amount)
  )
)

;; Withdraw received tokens
(define-public (withdraw 
  (stream-id uint)
)
  (let (
    (stream (unwrap! (map-get? streams stream-id) ERR_INVALID_STREAM_ID))
    (current-status (unwrap! (get status stream) (err u999)))
    (balance (balance-of stream-id contract-caller))
  )
    (asserts! (is-eq contract-caller (get recipient stream)) ERR_UNAUTHORIZED)
    (asserts! (not (is-eq current-status u2)) ERR_STREAM_CANCELLED)
    (map-set streams stream-id (merge stream {withdrawn-balance: (+ (get withdrawn-balance stream) balance)}))
    (try! (as-contract (stx-transfer? balance tx-sender (get recipient stream))))
    (ok balance)
  )
)

;; Withdraw excess locked tokens
(define-public (refund 
  (stream-id uint)
)
  (let (
    (stream (unwrap! (map-get? streams stream-id) ERR_INVALID_STREAM_ID))
    (balance (balance-of stream-id (get sender stream)))
  )
    (asserts! (is-eq contract-caller (get sender stream)) ERR_UNAUTHORIZED)
    (asserts! (< (get stop-block (get timeframe stream)) stacks-block-height) ERR_STREAM_STILL_ACTIVE)
    (map-set streams stream-id (merge stream {balance: (- (get balance stream) balance)}))
    (try! (as-contract (stx-transfer? balance tx-sender (get sender stream))))
    (ok balance)
  )
)

;; Update stream configuration
(define-public (update-details 
  (stream-id uint) 
  (payment-per-block uint) 
  (timeframe (tuple (start-block uint) (stop-block uint))) 
  (signer principal) 
  (signature (buff 65))
)
  (let (
    (stream (unwrap! (map-get? streams stream-id) ERR_INVALID_STREAM_ID))
  )
    (asserts! (validate-signature (hash-stream stream-id payment-per-block timeframe) signature signer) ERR_INVALID_SIGNATURE)
    (asserts! 
      (or 
        (and (is-eq (get sender stream) contract-caller) (is-eq (get recipient stream) signer))
        (and (is-eq (get sender stream) signer) (is-eq (get recipient stream) contract-caller))
      ) 
      ERR_UNAUTHORIZED
    )
    (map-set streams stream-id (merge stream {
      payment-per-block: payment-per-block,
      timeframe: timeframe
    }))
    (ok true)
  )
)

;; Pause a stream
(define-public (pause-stream 
  (stream-id uint)
)
  (let (
    (stream (unwrap! (map-get? streams stream-id) ERR_INVALID_STREAM_ID))
    (current-status (unwrap! (get status stream) (err u999)))
  )
    (asserts! (is-eq contract-caller (get sender stream)) ERR_UNAUTHORIZED)
    (asserts! (is-eq current-status u0) ERR_STREAM_ALREADY_PAUSED)
    (map-set streams stream-id (merge stream {
      status: STATUS_PAUSED,
      pause-block: stacks-block-height
    }))
    (ok true)
  )
)

;; Resume a paused stream
(define-public (resume-stream 
  (stream-id uint)
)
  (let (
    (stream (unwrap! (map-get? streams stream-id) ERR_INVALID_STREAM_ID))
    (current-status (unwrap! (get status stream) (err u999)))
    (paused-blocks (- stacks-block-height (get pause-block stream)))
  )
    (asserts! (is-eq contract-caller (get sender stream)) ERR_UNAUTHORIZED)
    (asserts! (is-eq current-status u1) ERR_STREAM_NOT_PAUSED)
    (map-set streams stream-id (merge stream {
      status: STATUS_ACTIVE,
      pause-block: u0,
      total-paused-blocks: (+ (get total-paused-blocks stream) paused-blocks)
    }))
    (ok true)
  )
)

;; Cancel a stream and refund unused tokens
(define-public (cancel-stream 
  (stream-id uint)
)
  (let (
    (stream (unwrap! (map-get? streams stream-id) ERR_INVALID_STREAM_ID))
    (remaining-balance (balance-of stream-id (get sender stream)))
  )
    (asserts! (is-eq contract-caller (get sender stream)) ERR_UNAUTHORIZED)
    (map-set streams stream-id (merge stream {
      status: STATUS_CANCELLED
    }))
    (try! (as-contract (stx-transfer? remaining-balance tx-sender (get sender stream))))
    (ok remaining-balance)
  )
)

;; read only functions
;; Calculate the number of blocks a stream has been active
(define-read-only (calculate-block-delta 
  (timeframe (tuple (start-block uint) (stop-block uint)))
)
  (let (
    (start-block (get start-block timeframe))
    (stop-block (get stop-block timeframe))
    (delta 
      (if (<= stacks-block-height start-block)
        ;; then
        u0
        ;; else
        (if (< stacks-block-height stop-block)
          ;; then
          (- stacks-block-height start-block)
          ;; else
          (- stop-block start-block)
        )
      )
    )
  )
    delta
  )
)

;; Check balance for a party involved in a stream
(define-read-only (balance-of 
  (stream-id uint) 
  (who principal)
)
  (let (
    (stream (unwrap! (map-get? streams stream-id) u0))
    (block-delta (calculate-block-delta (get timeframe stream)))
    (adjusted-delta 
      (if (is-eq (unwrap! (get status stream) u999) u1)
        ;; If paused, calculate delta up to pause-block only
        (let (
          (pause-block (get pause-block stream))
          (start-block (get start-block (get timeframe stream)))
        )
          (if (<= pause-block start-block)
            u0
            (- pause-block start-block)
          )
        )
        ;; If not paused, subtract total paused blocks
        (- block-delta (get total-paused-blocks stream))
      )
    )
    (effective-delta (if (< adjusted-delta u0) u0 adjusted-delta))
    (recipient-balance (* effective-delta (get payment-per-block stream)))
  )
    (if (is-eq who (get recipient stream))
      (- recipient-balance (get withdrawn-balance stream))
      (if (is-eq who (get sender stream))
        (- (get balance stream) recipient-balance)
        u0
      )
    )
  )
)

;; Get hash of stream
(define-read-only (hash-stream 
  (stream-id uint) 
  (new-payment-per-block uint) 
  (new-timeframe (tuple (start-block uint) (stop-block uint)))
)
  (let (
    (stream (unwrap! (map-get? streams stream-id) (sha256 0)))
    (msg (concat 
      (concat 
        (unwrap-panic (to-consensus-buff? stream)) 
        (unwrap-panic (to-consensus-buff? new-payment-per-block))
      ) 
      (unwrap-panic (to-consensus-buff? new-timeframe))
    ))
  )
    (sha256 msg)
  )
)

;; Signature verification
(define-read-only (validate-signature 
  (hash (buff 32)) 
  (signature (buff 65)) 
  (signer principal)
)
  (is-eq 
    (principal-of? (unwrap! (secp256k1-recover? hash signature) false)) 
    (ok signer)
  )
)

;; Get stream status
(define-read-only (get-stream-status 
  (stream-id uint)
)
  (let (
    (stream (unwrap! (map-get? streams stream-id) (err u999)))
  )
    (ok (get status stream))
  )
)

;; Get latest stream ID
(define-read-only (get-latest-stream-id)
  (ok (var-get latest-stream-id))
)

;; Get full stream data
(define-read-only (get-stream
  (stream-id uint)
)
  (ok (unwrap! (map-get? streams stream-id) (err u999)))
)

;; private functions
;;

