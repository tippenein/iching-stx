;; title: Hexagram Registry
;; version: 3.0
;; summary: A contract to record encrypted I Ching hexagram readings with timestamps
;; description: This contract allows users to submit encrypted hexagrams and record them
;; permanently on the blockchain. Hexagram data is encrypted client-side before submission.

;; constants
(define-constant ERR_UNAUTHORIZED (err u1))
(define-constant ERR_INVALID_HEXAGRAM (err u2))
(define-constant ERR_VRF_SEED_NOT_FOUND (err u3))

;; data vars
(define-data-var next-id uint u1)

;; data maps
(define-map hexagrams
  { id: uint, owner: principal }
  { hexagram: (buff 512), timestamp: uint })

(define-map owner-hexagram-count
  { owner: principal }
  { count: uint })

(define-map owner-hexagram-index
  { owner: principal, index: uint }
  { id: uint })

;; public functions
(define-public (submit-hexagram
  (hexagram (buff 512))
  (timestamp uint)
)
  (let (
    (current-id (var-get next-id))
    (current-count (default-to u0 (get count (map-get? owner-hexagram-count { owner: tx-sender }))))
  )
    (asserts! (> (len hexagram) u0) ERR_INVALID_HEXAGRAM)
    (asserts! (> timestamp u0) ERR_INVALID_HEXAGRAM)

    (map-set hexagrams
      { id: current-id, owner: tx-sender }
      { hexagram: hexagram, timestamp: timestamp })

    (map-set owner-hexagram-count
      { owner: tx-sender }
      { count: (+ current-count u1) })

    (map-set owner-hexagram-index
      { owner: tx-sender, index: current-count }
      { id: current-id })

    (var-set next-id (+ current-id u1))
    (ok current-id)
  )
)

(define-public (get-hexagram-by-id (id uint))
  (let (
    (hexagram-entry (map-get? hexagrams { id: id, owner: tx-sender }))
  )
    (match hexagram-entry
      entry (ok entry)
      (err u1)
    )
  )
)

;; read only functions
(define-read-only (get-hexagram-by-owner-and-id (owner principal) (id uint))
  (map-get? hexagrams { id: id, owner: owner })
)

(define-read-only (get-current-id)
  (- (var-get next-id) u1)
)

(define-read-only (get-owner-hexagram-count (owner principal))
  (default-to u0 (get count (map-get? owner-hexagram-count { owner: owner })))
)

(define-read-only (get-owner-hexagram-id-at-index (owner principal) (index uint))
  (map-get? owner-hexagram-index { owner: owner, index: index })
)

(define-read-only (get-hexagram-entry (id uint) (owner principal))
  (map-get? hexagrams { id: id, owner: owner })
)

;; private helpers for VRF-based hexagram generation
(define-private (derive-line (seed (buff 32)) (index uint))
  (let (
    (hash (keccak256 (concat seed (unwrap-panic (to-consensus-buff? index)))))
    (slice16 (unwrap-panic (as-max-len? (unwrap-panic (slice? hash u0 u16)) u16)))
    (rand (buff-to-uint-be slice16))
  )
    (+ u6 (mod rand u4))
  )
)

;; public function: generate a hexagram on-chain using VRF randomness
(define-public (roll-hexagram)
  (let (
    (vrf-seed (unwrap! (get-block-info? vrf-seed (- block-height u1)) ERR_VRF_SEED_NOT_FOUND))
    (personal-seed (keccak256 (concat vrf-seed (unwrap-panic (to-consensus-buff? tx-sender)))))
    (line0 (derive-line personal-seed u0))
    (line1 (derive-line personal-seed u1))
    (line2 (derive-line personal-seed u2))
    (line3 (derive-line personal-seed u3))
    (line4 (derive-line personal-seed u4))
    (line5 (derive-line personal-seed u5))
    (lines (list line0 line1 line2 line3 line4 line5))
    (current-id (var-get next-id))
    (current-count (default-to u0 (get count (map-get? owner-hexagram-count { owner: tx-sender }))))
    (hexagram-buf (unwrap-panic (to-consensus-buff? lines)))
  )
    (map-set hexagrams
      { id: current-id, owner: tx-sender }
      { hexagram: hexagram-buf, timestamp: block-height })

    (map-set owner-hexagram-count
      { owner: tx-sender }
      { count: (+ current-count u1) })

    (map-set owner-hexagram-index
      { owner: tx-sender, index: current-count }
      { id: current-id })

    (var-set next-id (+ current-id u1))
    (ok { id: current-id, lines: lines })
  )
)
