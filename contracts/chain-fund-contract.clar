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

;; User contributions tracking
(define-map user-contributions principal uint)

;; Campaign total contributors
(define-map campaign-total-contributors uint uint)

;; Campaign completion tracking
(define-map campaign-completed uint bool)

;; Campaign verification records
(define-map campaign-verification-records uint principal)

;; Campaign refund tracking
(define-map campaign-refunds uint bool)

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

;; Helper function to update campaign status
(define-private (update-campaign-status (campaign-id uint))
  (let ((status (map-get? campaign-status campaign-id)))
    (if (is-some status)
      (let ((current-status (unwrap-panic status)))
        (if (is-eq current-status CAMPAIGN-STATUS-ACTIVE)
          (if (has-campaign-ended? campaign-id)
            (if (is-goal-reached? campaign-id)
              (begin (map-set campaign-status campaign-id CAMPAIGN-STATUS-SUCCESSFUL) (ok u0))
              (begin (map-set campaign-status campaign-id CAMPAIGN-STATUS-FAILED) (ok u0))
            )
            (ok u0)
          )
          (ok u0)
        )
      )
      (err ERR-CAMPAIGN-NOT-FOUND)
    )
  )
)

;; Helper function to get user contribution amount
(define-private (get-user-contribution (user principal) (campaign-id uint))
  (unwrap! (map-get? user-contributions user) u0)
)

;; Helper function to update user contribution
(define-private (update-user-contribution (user principal) (campaign-id uint) (amount uint))
  (let ((current-contribution (get-user-contribution user campaign-id))
        (new-total (+ current-contribution amount)))
    (map-set user-contributions user new-total)
    new-total
  )
)

;; Helper function to update campaign total contributors
(define-private (update-campaign-contributors (campaign-id uint))
  (let ((current-contributors (unwrap! (map-get? campaign-total-contributors campaign-id) u0)))
    (map-set campaign-total-contributors campaign-id (+ current-contributors u1))
    (+ current-contributors u1)
  )
)

;; Helper function to verify campaign
(define-private (verify-campaign (campaign-id uint) (verifier principal))
  (map-set campaign-verified campaign-id true)
  (map-set campaign-verification-records campaign-id verifier)
  (ok u0)
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
    (map-set campaign-total-contributors campaign-id u0)
    (map-set campaign-completed campaign-id false)
    (map-set campaign-refunds campaign-id false)
    
    ;; Update platform statistics
    (var-set total-campaigns (+ (var-get total-campaigns) u1))
    
    (ok campaign-id)
  )
)

;; Contribute to a campaign
(define-public (contribute (campaign-id uint))
  (let ((contributor tx-sender))
    
    ;; Validate campaign exists and is active
    (try! (if (not (campaign-exists? campaign-id)) (err ERR-CAMPAIGN-NOT-FOUND) (ok u0)))
    (try! (if (not (is-campaign-active? campaign-id)) (err ERR-CAMPAIGN-NOT-ACTIVE) (ok u0)))
    
    ;; Get contribution amount from transaction
    (let ((contribution-amount (stx-get-balance tx-sender)))
      
      ;; Validate contribution amount
      (try! (if (< contribution-amount MIN-CONTRIBUTION) (err ERR-INVALID-AMOUNT) (ok u0)))
      
      ;; Get current campaign data
      (let ((current-raised (unwrap-panic (map-get? campaign-raised campaign-id)))
            (goal (unwrap-panic (map-get? campaign-goals campaign-id))))
        
        ;; Check if goal is already reached
        (try! (if (>= current-raised goal) (err ERR-GOAL-ALREADY-REACHED) (ok u0)))
        
        ;; Calculate platform fee
        (let ((platform-fee (calculate-platform-fee contribution-amount))
              (net-contribution (- contribution-amount platform-fee))
              (new-total (+ current-raised net-contribution)))
          
          ;; Update campaign raised amount
          (map-set campaign-raised campaign-id new-total)
          
          ;; Update user contribution and campaign contributors count
          (let ((new-user-total (update-user-contribution contributor campaign-id contribution-amount))
                (user-contribution (get-user-contribution contributor campaign-id)))
            (if (is-eq user-contribution contribution-amount)
              (update-campaign-contributors campaign-id)
              u0
            )
          )
          
          ;; Update platform statistics
          (var-set total-raised (+ (var-get total-raised) net-contribution))
          (var-set platform-fees (+ (var-get platform-fees) platform-fee))
          
          ;; Check if goal is reached after this contribution
          (if (>= new-total goal)
            (begin (map-set campaign-status campaign-id CAMPAIGN-STATUS-SUCCESSFUL) (ok u0))
            (ok u0)
          )
          
          (ok (tuple
            (contribution-amount contribution-amount)
            (platform-fee platform-fee)
            (net-contribution net-contribution)
            (new-total new-total)
          ))
        )
      )
    )
  )
)

;; Complete campaign and release funds
(define-public (complete-campaign (campaign-id uint))
  (let ((creator (get-campaign-creator campaign-id))
        (beneficiary (get-campaign-beneficiary campaign-id))
        (status (unwrap-panic (map-get? campaign-status campaign-id)))
        (raised (unwrap-panic (map-get? campaign-raised campaign-id))))
    
    ;; Only creator can complete campaign
    (try! (if (not (is-eq tx-sender creator)) (err ERR-UNAUTHORIZED) (ok u0)))
    
    ;; Check if campaign is already completed
    (let ((completed (unwrap! (map-get? campaign-completed campaign-id) false)))
      (try! (if completed (err ERR-CAMPAIGN-ALREADY-CANCELLED) (ok u0)))
    )
    
    ;; Update campaign status if needed
    (try! (update-campaign-status campaign-id))
    
    ;; Mark campaign as completed
    (map-set campaign-completed campaign-id true)
    
    ;; Release funds to beneficiary if successful
    (if (is-eq status CAMPAIGN-STATUS-SUCCESSFUL)
      (stx-transfer? raised tx-sender beneficiary)
      (ok u0)
    )
    
    (ok (tuple
      (status status)
      (raised raised)
      (released (is-eq status CAMPAIGN-STATUS-SUCCESSFUL))
    ))
  )
)

;; Cancel campaign (only creator can cancel)
(define-public (cancel-campaign (campaign-id uint))
  (let ((creator (get-campaign-creator campaign-id))
        (status (unwrap-panic (map-get? campaign-status campaign-id))))
    
    ;; Only creator can cancel campaign
    (try! (if (not (is-eq tx-sender creator)) (err ERR-UNAUTHORIZED) (ok u0)))
    
    ;; Check if campaign is already cancelled or completed
    (let ((completed (unwrap! (map-get? campaign-completed campaign-id) false)))
      (try! (if (is-eq status CAMPAIGN-STATUS-CANCELLED) 
                 (err ERR-CAMPAIGN-ALREADY-CANCELLED) 
                 (if completed (err ERR-CAMPAIGN-ALREADY-CANCELLED) (ok u0))))
    )
    
    ;; Update campaign status to cancelled
    (map-set campaign-status campaign-id CAMPAIGN-STATUS-CANCELLED)
    
    (ok (tuple
      (campaign-id campaign-id)
      (status CAMPAIGN-STATUS-CANCELLED)
      (cancelled-by tx-sender)
    ))
  )
)

;; Verify campaign (for platform administrators)
(define-public (verify-campaign-public (campaign-id uint))
  (let ((verifier tx-sender))
    
    ;; Check if campaign exists
    (try! (if (not (campaign-exists? campaign-id)) (err ERR-CAMPAIGN-NOT-FOUND) (ok u0)))
    
    ;; Check if campaign is already verified
    (let ((is-verified (unwrap! (map-get? campaign-verified campaign-id) false)))
      (try! (if is-verified (err ERR-CAMPAIGN-ALREADY-EXISTS) (ok u0)))
    )
    
    ;; Verify the campaign
    (try! (verify-campaign campaign-id verifier))
    
    (ok (tuple
      (campaign-id campaign-id)
      (verified-by verifier)
      (verification-block (get-current-block))
    ))
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

;; Get user contribution for a campaign
(define-read-only (get-user-contribution-amount (user principal) (campaign-id uint))
  (ok (get-user-contribution user campaign-id))
)

;; Get campaign contributors count
(define-read-only (get-campaign-contributors-count (campaign-id uint))
  (let ((count (map-get? campaign-total-contributors campaign-id)))
    (ok (unwrap! count u0))
  )
)

;; Get campaign verification info
(define-read-only (get-campaign-verification (campaign-id uint))
  (let ((is-verified (map-get? campaign-verified campaign-id))
        (verified-by (map-get? campaign-verification-records campaign-id)))
    (ok (tuple
      (is-verified (unwrap! is-verified false))
      (verified-by (unwrap! verified-by tx-sender))
    ))
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

;; Get campaign progress percentage
(define-read-only (get-campaign-progress (campaign-id uint))
  (let ((goal (map-get? campaign-goals campaign-id))
        (raised (map-get? campaign-raised campaign-id)))
    (if (and (is-some goal) (is-some raised))
      (let ((goal-amount (unwrap-panic goal))
            (raised-amount (unwrap-panic raised)))
        (if (> goal-amount u0)
          (ok (/ (* raised-amount u100) goal-amount))
          (ok u0)
        )
      )
      (err ERR-CAMPAIGN-NOT-FOUND)
    )
  )
)

;; Get campaign time remaining
(define-read-only (get-campaign-time-remaining (campaign-id uint))
  (let ((end-block (map-get? campaign-end-blocks campaign-id))
        (current-block (get-current-block)))
    (if (is-some end-block)
      (let ((end (unwrap-panic end-block)))
        (if (> end current-block)
          (ok (- end current-block))
          (ok u0)
        )
      )
      (err ERR-CAMPAIGN-NOT-FOUND)
    )
  )
)
