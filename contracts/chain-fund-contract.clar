;; ChainFundMe - Decentralized Crowdfunding Contract
;; A smart contract for creating and managing crowdfunding campaigns
;; Funds are only released when campaign goals are reached
;; Built for Stacks blockchain using Clarity language

;; =============================================================================
;; CONSTANTS
;; =============================================================================

;; Campaign status constants
(define-constant CAMPAIGN-STATUS-ACTIVE u0)
(define-constant CAMPAIGN-STATUS-SUCCESSFUL u1)
(define-constant CAMPAIGN-STATUS-FAILED u2)
(define-constant CAMPAIGN-STATUS-CANCELLED u3)

;; Error codes
(define-constant ERR-CAMPAIGN-NOT-FOUND u100)
(define-constant ERR-CAMPAIGN-ALREADY-EXISTS u101)
(define-constant ERR-CAMPAIGN-ENDED u102)
(define-constant ERR-INSUFFICIENT-FUNDS u103)
(define-constant ERR-INVALID-AMOUNT u104)
(define-constant ERR-UNAUTHORIZED u105)
(define-constant ERR-CAMPAIGN-NOT-ACTIVE u106)
(define-constant ERR-GOAL-ALREADY-REACHED u107)
(define-constant ERR-CAMPAIGN-ALREADY-CANCELLED u108)
(define-constant ERR-REFUND-NOT-ALLOWED u109)

;; Minimum campaign duration (in blocks)
(define-constant MIN-CAMPAIGN-DURATION u1440)
;; Maximum campaign duration (in blocks)
(define-constant MAX-CAMPAIGN-DURATION u43200)
;; Minimum contribution amount (in microSTX)
(define-constant MIN-CONTRIBUTION u1000000)
;; Platform fee percentage (0.5% = 50 basis points)
(define-constant PLATFORM-FEE-BPS u50)

;; =============================================================================
;; DATA MODELS AND TYPES
;; =============================================================================

;; Campaign counter
(define-data-var campaign-counter uint u0)

;; Campaign creators
(define-map campaign-creators uint principal)

;; Campaign goals
(define-map campaign-goals uint uint)

;; Campaign raised amounts
(define-map campaign-raised uint uint)

;; Campaign status
(define-map campaign-status uint uint)

;; Campaign start blocks
(define-map campaign-start-blocks uint uint)

;; Campaign end blocks
(define-map campaign-end-blocks uint uint)

;; Campaign titles
(define-map campaign-titles uint (string-ascii 100))

;; Campaign descriptions
(define-map campaign-descriptions uint (string-utf8 1000))

;; Campaign categories
(define-map campaign-categories uint (string-ascii 50))

;; Campaign beneficiaries
(define-map campaign-beneficiaries uint principal)

;; Campaign verification status
(define-map campaign-verified uint bool)

;; Contributor amounts
(define-map contribution-amounts uint uint)

;; Platform statistics
(define-data-var total-campaigns uint u0)
(define-data-var total-raised uint u0)
(define-data-var platform-fees uint u0)

;; =============================================================================
;; PRIVATE FUNCTIONS
;; =============================================================================

;; Helper function to check if campaign exists
(define-private (campaign-exists? (campaign-id uint))
  (is-some (map-get? campaign-creators campaign-id))
)

;; Helper function to get current block height
(define-private (get-current-block)
  block-height
)

;; Helper function to check if campaign is active
(define-private (is-campaign-active? (campaign-id uint))
  (let ((status (map-get? campaign-status campaign-id))
        (end-block (map-get? campaign-end-blocks campaign-id)))
    (if (and (is-some status) (is-some end-block))
      (and (is-eq (unwrap-panic status) CAMPAIGN-STATUS-ACTIVE)
           (< (get-current-block) (unwrap-panic end-block)))
      false
    )
  )
)

;; Helper function to check if campaign has ended
(define-private (has-campaign-ended? (campaign-id uint))
  (let ((end-block (map-get? campaign-end-blocks campaign-id)))
    (if (is-some end-block)
      (>= (get-current-block) (unwrap-panic end-block))
      false
    )
  )
)

;; Helper function to check if campaign goal is reached
(define-private (is-goal-reached? (campaign-id uint))
  (let ((goal (map-get? campaign-goals campaign-id))
        (raised (map-get? campaign-raised campaign-id)))
    (if (and (is-some goal) (is-some raised))
      (>= (unwrap-panic raised) (unwrap-panic goal))
      false
    )
  )
)

;; Helper function to calculate platform fee
(define-private (calculate-platform-fee (amount uint))
  (/ (* amount PLATFORM-FEE-BPS) u10000)
)

;; Helper function to get campaign creator
(define-private (get-campaign-creator (campaign-id uint))
  (unwrap-panic (map-get? campaign-creators campaign-id))
)

;; Helper function to get campaign beneficiary
(define-private (get-campaign-beneficiary (campaign-id uint))
  (unwrap-panic (map-get? campaign-beneficiaries campaign-id))
)

;; =============================================================================
;; PUBLIC FUNCTIONS
;; =============================================================================

;; Create a new crowdfunding campaign
(define-public (create-campaign
  (title (string-ascii 100))
  (description (string-utf8 1000))
  (goal uint)
  (duration uint)
  (category (string-ascii 50))
  (beneficiary principal)
)
  (let ((campaign-id (+ (var-get campaign-counter) u1))
        (current-block (get-current-block))
        (creator tx-sender))
    
    ;; Validate inputs
    (try! (if (<= goal u0) (err ERR-INVALID-AMOUNT) (ok u0)))
    (try! (if (< duration MIN-CAMPAIGN-DURATION) (err ERR-INVALID-AMOUNT) (ok u0)))
    (try! (if (> duration MAX-CAMPAIGN-DURATION) (err ERR-INVALID-AMOUNT) (ok u0)))
    
    ;; Update campaign counter
    (var-set campaign-counter campaign-id)
    
    ;; Store campaign data
    (map-set campaign-creators campaign-id creator)
    (map-set campaign-titles campaign-id title)
    (map-set campaign-descriptions campaign-id description)
    (map-set campaign-goals campaign-id goal)
    (map-set campaign-raised campaign-id u0)
    (map-set campaign-start-blocks campaign-id current-block)
    (map-set campaign-end-blocks campaign-id (+ current-block duration))
    (map-set campaign-status campaign-id CAMPAIGN-STATUS-ACTIVE)
    (map-set campaign-categories campaign-id category)
    (map-set campaign-beneficiaries campaign-id beneficiary)
    (map-set campaign-verified campaign-id false)
    
    ;; Update platform statistics
    (var-set total-campaigns (+ (var-get total-campaigns) u1))
    
    (ok campaign-id)
  )
)

;; Get campaign information
(define-read-only (get-campaign-info (campaign-id uint))
  (let ((creator (map-get? campaign-creators campaign-id))
        (title (map-get? campaign-titles campaign-id))
        (description (map-get? campaign-descriptions campaign-id))
        (goal (map-get? campaign-goals campaign-id))
        (raised (map-get? campaign-raised campaign-id))
        (start-block (map-get? campaign-start-blocks campaign-id))
        (end-block (map-get? campaign-end-blocks campaign-id))
        (status (map-get? campaign-status campaign-id))
        (category (map-get? campaign-categories campaign-id))
        (beneficiary (map-get? campaign-beneficiaries campaign-id))
        (is-verified (map-get? campaign-verified campaign-id)))
    
    (ok (tuple
      (creator (unwrap-panic creator))
      (title (unwrap-panic title))
      (description (unwrap-panic description))
      (goal (unwrap-panic goal))
      (raised (unwrap-panic raised))
      (start-block (unwrap-panic start-block))
      (end-block (unwrap-panic end-block))
      (status (unwrap-panic status))
      (category (unwrap-panic category))
      (beneficiary (unwrap-panic beneficiary))
      (is-verified (unwrap-panic is-verified))
    ))
  )
)

;; Get campaign status
(define-read-only (get-campaign-status (campaign-id uint))
  (let ((status (map-get? campaign-status campaign-id)))
    (ok (unwrap-panic status))
  )
)

;; Get campaign raised amount
(define-read-only (get-campaign-raised (campaign-id uint))
  (let ((raised (map-get? campaign-raised campaign-id)))
    (ok (unwrap-panic raised))
  )
)

;; Get total number of campaigns
(define-read-only (get-total-campaigns)
  (ok (var-get total-campaigns))
)

;; Get platform statistics
(define-read-only (get-platform-stats)
  (ok (tuple
    (total-campaigns (var-get total-campaigns))
    (total-raised (var-get total-raised))
    (platform-fees (var-get platform-fees))
  ))
)
