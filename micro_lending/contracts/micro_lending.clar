;; microlending
;; This smart contract implements an enhanced microlending platform with robust security features. 
;; It allows users to create and manage loans backed by collateral assets. The contract includes 
;; mechanisms for collateral management, price feed updates, loan creation, and liquidation. 
;; It also features an emergency stop function to halt operations in critical situations and 
;; maintains user reputation based on loan repayment history.

;; Error Codes
(define-constant ERR-NOT-AUTHORIZED (err u1000))
(define-constant ERR-INVALID-AMOUNT (err u1001))
(define-constant ERR-INSUFFICIENT-COLLATERAL (err u1002))
(define-constant ERR-LOAN-NOT-FOUND (err u1003))
(define-constant ERR-LOAN-ALREADY-ACTIVE (err u1004))
(define-constant ERR-LOAN-NOT-ACTIVE (err u1005))
(define-constant ERR-LOAN-NOT-DEFAULTED (err u1006))
(define-constant ERR-INVALID-LIQUIDATION (err u1007))
(define-constant ERR-INVALID-REPAYMENT (err u1008))
(define-constant ERR-INVALID-DURATION (err u1009))
(define-constant ERR-INVALID-INTEREST-RATE (err u1010))
(define-constant ERR-EMERGENCY-STOP (err u1011))
(define-constant ERR-PRICE-FEED-FAILURE (err u1012))
(define-constant ERR-INVALID-COLLATERAL-ASSET (err u1013))
(define-constant tx-sender-zero (as-contract tx-sender))

;; Business Constants
(define-constant MIN-COLLATERAL-RATIO u200) ;; 200%
(define-constant MAX-INTEREST-RATE u5000) ;; 50%
(define-constant MIN-DURATION u1440) ;; Minimum 1 day
(define-constant MAX-DURATION u525600) ;; Maximum 1 year
(define-constant LIQUIDATION-THRESHOLD u80) ;; 80% collateral value drop
(define-constant MAX-PRICE-AGE u1440) ;; Maximum price age (1 day in blocks)
(define-constant MIN-REPUTATION-SCORE u0)
(define-constant MAX-REPUTATION-SCORE u200)
(define-constant REPUTATION_PENALTY u20)
(define-constant REPUTATION_REWARD u10)

;; Contract State Variables
(define-data-var emergency-stopped bool false)
(define-data-var contract-owner principal tx-sender)
(define-data-var next-loan-id uint u1)

;; Whitelist for Collateral Assets
(define-map allowed-collateral-assets 
    { asset: (string-ascii 20) } 
    { is-active: bool }
)

;; Price Feed Simulation
(define-map asset-prices 
    { asset: (string-ascii 20) } 
    { 
        price: uint, 
        last-updated: uint 
    }
)

;; Loans Tracking
(define-map loans
    { loan-id: uint }
    {
        borrower: principal,
        amount: uint,
        collateral-amount: uint,
        collateral-asset: (string-ascii 20),
        interest-rate: uint,
        start-height: uint,
        duration: uint,
        status: (string-ascii 20),
        lenders: (list 20 principal),
        repaid-amount: uint,
        liquidation-price-threshold: uint
    }
)

;; User Loans Tracking
(define-map user-loans
    { user: principal }
    { 
        active-loans: (list 20 uint),
        total-active-borrowed: uint 
    }
)

;; User Reputation Tracking
(define-map user-reputation
    { user: principal }
    {
        successful-repayments: uint,
        defaults: uint,
        total-borrowed: uint,
        reputation-score: uint
    }
)
