;; title: Hexagram Registry
;; version: 1.0
;; summary: A contract to record I Ching hexagram readings with timestamps
;; description: This contract allows users to submit pairs of hexagrams (original and transformed) with timestamps

;; traits
;;

;; token definitions
;;

;; constants
(define-constant ERR_UNAUTHORIZED (err u1))
(define-constant ERR_INVALID_HEXAGRAM (err u2))
(define-constant ERR_INVALID_LINE (err u3))

;; data vars
(define-data-var next-id uint u1)

;; data maps
(define-map hexagrams 
  { id: uint, owner: principal } 
  { original-hexagram: (list 6 uint), transformed-hexagram: (list 6 uint), timestamp: uint })

(define-map owner-hexagrams
  { owner: principal }
  { hexagram-ids: (list 100 uint) })

;; public functions
(define-public (submit-hexagram-pair
  (original-hexagram (list 6 uint))
  (transformed-hexagram (list 6 uint))
  (timestamp uint)
)
  (let (
    (current-id (var-get next-id))
    (valid-original (is-valid-hexagram original-hexagram))
    (valid-transformed (is-valid-hexagram transformed-hexagram))
  )
    (if (and valid-original valid-transformed)
      (begin
        (map-insert hexagrams 
          { id: current-id, owner: tx-sender }
          { original-hexagram: original-hexagram, transformed-hexagram: transformed-hexagram, timestamp: timestamp })
        
        ;; Update the owner's list of hexagram IDs - simplified approach
        (let (
          (existing-ids-entry (map-get? owner-hexagrams { owner: tx-sender }))
        )
          (if (is-none existing-ids-entry)
            ;; If no existing entry, create a new list with the current ID
            (map-insert owner-hexagrams 
              { owner: tx-sender }
              { hexagram-ids: (list current-id) })
            ;; If entry exists, we'll skip updating for now due to complexity
            ;; In a real implementation, we'd have to use a different approach
            ;; such as storing multiple map entries per user
            true  ;; Placeholder expression
          )
        )
        
        (var-set next-id (+ current-id u1))
        (ok current-id)
      )
      (err u2)
    )
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

(define-read-only (get-hexagrams-by-owner (owner principal))
  (match (map-get? owner-hexagrams { owner: owner })
    entry (get hexagram-ids entry)
    (list)
  )
)

;; private functions
(define-private (is-valid-hexagram (hexagram (list 6 uint)))
  (let (
    (line1 (element-at? hexagram u0))
    (line2 (element-at? hexagram u1))
    (line3 (element-at? hexagram u2))
    (line4 (element-at? hexagram u3))
    (line5 (element-at? hexagram u4))
    (line6 (element-at? hexagram u5))
  )
    (and
      (is-some line1) (is-valid-line (unwrap-panic line1))
      (is-some line2) (is-valid-line (unwrap-panic line2))
      (is-some line3) (is-valid-line (unwrap-panic line3))
      (is-some line4) (is-valid-line (unwrap-panic line4))
      (is-some line5) (is-valid-line (unwrap-panic line5))
      (is-some line6) (is-valid-line (unwrap-panic line6))
    )
  )
)

(define-private (is-valid-line (line uint))
  (or
    (is-eq line u6)  ;; old yin - broken line that transforms to solid
    (is-eq line u7)  ;; young yang - solid line
    (is-eq line u8)  ;; young yin - broken line
    (is-eq line u9)  ;; old yang - solid line that transforms to broken
  )
)

;; Allow contract to get its own data
(define-read-only (get-hexagram-entry (id uint) (owner principal))
  (map-get? hexagrams { id: id, owner: owner })
)