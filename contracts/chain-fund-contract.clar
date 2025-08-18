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
