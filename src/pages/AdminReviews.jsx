import React, {
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react';

import DashboardShell from '../components/DashboardShell';
import { supabase } from '../lib/supabase';

import './admin-reviews.css';

const STAFF_ROLES = [
  'admin',
  'expert',
  'support',
  'finance'
];

const REVIEW_STATUSES = [
  'pending',
  'published',
  'hidden',
  'rejected'
];

const RATING_OPTIONS = [
  'all',
  '5',
  '4',
  '3',
  '2',
  '1'
];

function formatDate(value) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date);
}

function formatDateTime(value) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
}

function getInitials(name = '') {
  const parts = String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) {
    return '?';
  }

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function formatStatus(status) {
  return String(status || 'pending')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getStatusClass(status) {
  return `is-${String(status || 'pending')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')}`;
}

function RatingStars({
  rating,
  interactive = false,
  value,
  onChange
}) {
  const current = Number(
    interactive ? value : rating
  ) || 0;

  return (
    <div
      className={`admin-review-stars ${
        interactive ? 'is-interactive' : ''
      }`}
      aria-label={`${current} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const active = star <= current;

        if (interactive) {
          return (
            <button
              type="button"
              key={star}
              className={active ? 'is-active' : ''}
              onClick={() => onChange?.(star)}
              aria-label={`${star} star${
                star === 1 ? '' : 's'
              }`}
            >
              ★
            </button>
          );
        }

        return (
          <span
            key={star}
            className={active ? 'is-active' : ''}
          >
            ★
          </span>
        );
      })}
    </div>
  );
}

function StatCard({
  label,
  value,
  detail,
  accent
}) {
  return (
    <div
      className={`admin-review-stat ${
        accent ? `is-${accent}` : ''
      }`}
    >
      <span>{label}</span>
      <strong>{value}</strong>

      {detail && (
        <small>{detail}</small>
      )}
    </div>
  );
}

function ReviewDrawer({
  review,
  onClose,
  onStatusChange,
  onFeaturedChange,
  onReply,
  saving
}) {
  const [reply, setReply] = useState(
    review?.admin_reply || ''
  );

  const [rating, setRating] = useState(
    Number(review?.rating) || 0
  );

  useEffect(() => {
    setReply(review?.admin_reply || '');
    setRating(Number(review?.rating) || 0);
  }, [review]);

  if (!review) {
    return null;
  }

  async function handleReply(event) {
    event.preventDefault();

    await onReply(
      review.id,
      reply.trim()
    );
  }

  async function handleRatingChange(nextRating) {
    setRating(nextRating);
  }

  return (
    <div
      className="admin-review-drawer-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <aside
        className="admin-review-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-review-drawer-title"
      >
        <header className="admin-review-drawer-head">
          <div>
            <p className="admin-review-kicker">
              REVIEW DETAILS
            </p>

            <h2 id="admin-review-drawer-title">
              Client feedback
            </h2>
          </div>

          <button
            type="button"
            className="admin-review-close"
            onClick={onClose}
            aria-label="Close review details"
          >
            ×
          </button>
        </header>

        <div className="admin-review-drawer-body">
          <section className="admin-review-profile">
            <div className="admin-review-avatar large">
              {getInitials(
                review.client_name || 'Client'
              )}
            </div>

            <div>
              <strong>
                {review.client_name ||
                  'Client'}
              </strong>

              <span>
                {review.client_email ||
                  'No email available'}
              </span>
            </div>
          </section>

          <section className="admin-review-detail-card">
            <div className="admin-review-detail-top">
              <div>
                <span className="admin-review-label">
                  Service
                </span>

                <strong>
                  {review.service_name ||
                    'Careerlyst service'}
                </strong>
              </div>

              <span
                className={`admin-review-status ${getStatusClass(
                  review.status
                )}`}
              >
                {formatStatus(
                  review.status
                )}
              </span>
            </div>

            <div className="admin-review-detail-meta">
              <span>
                Order #{review.order_id || '—'}
              </span>

              <span>
                {formatDateTime(
                  review.created_at
                )}
              </span>
            </div>
          </section>

          <section className="admin-review-rating-editor">
            <div>
              <span className="admin-review-label">
                Rating
              </span>

              <RatingStars
                interactive
                value={rating}
                onChange={handleRatingChange}
              />
            </div>

            <span className="admin-review-rating-number">
              {rating}/5
            </span>
          </section>

          <section className="admin-review-message-card">
            <span className="admin-review-label">
              Client review
            </span>

            <p>
              {review.review_text ||
                'No review text was provided.'}
            </p>
          </section>

          <section className="admin-review-controls">
            <div>
              <span className="admin-review-label">
                Visibility
              </span>

              <div className="admin-review-status-actions">
                {REVIEW_STATUSES.map(
                  (status) => (
                    <button
                      type="button"
                      key={status}
                      className={
                        review.status ===
                        status
                          ? 'is-active'
                          : ''
                      }
                      disabled={saving}
                      onClick={() =>
                        onStatusChange(
                          review.id,
                          status
                        )
                      }
                    >
                      {formatStatus(status)}
                    </button>
                  )
                )}
              </div>
            </div>

            <label className="admin-review-feature-toggle">
              <input
                type="checkbox"
                checked={Boolean(
                  review.featured
                )}
                disabled={saving}
                onChange={(event) =>
                  onFeaturedChange(
                    review.id,
                    event.target.checked
                  )
                }
              />

              <span>
                <strong>
                  Featured review
                </strong>

                <small>
                  Show this review in featured
                  review sections.
                </small>
              </span>
            </label>
          </section>

          <section className="admin-review-reply">
            <div>
              <span className="admin-review-label">
                Admin reply
              </span>

              <small>
                Reply shown alongside the client
                review.
              </small>
            </div>

            <form onSubmit={handleReply}>
              <textarea
                value={reply}
                onChange={(event) =>
                  setReply(event.target.value)
                }
                placeholder="Write a professional reply to this client…"
                rows={5}
                maxLength={2000}
                disabled={saving}
              />

              <div className="admin-review-reply-footer">
                <span>
                  {reply.length}/2000
                </span>

                <button
                  type="submit"
                  className="admin-review-primary-btn"
                  disabled={
                    saving ||
                    !reply.trim()
                  }
                >
                  {saving
                    ? 'Saving…'
                    : 'Save reply'}
                </button>
              </div>
            </form>
          </section>
        </div>
      </aside>
    </div>
  );
}

function AdminReviewsPage() {
  const [reviews, setReviews] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState('');

  const [notice, setNotice] =
    useState('');

  const [search, setSearch] =
    useState('');

  const [statusFilter, setStatusFilter] =
    useState('all');

  const [ratingFilter, setRatingFilter] =
    useState('all');

  const [serviceFilter, setServiceFilter] =
    useState('all');

  const [selectedReview, setSelectedReview] =
    useState(null);

  const [savingId, setSavingId] =
    useState(null);

  const [connection, setConnection] =
    useState('connecting');

  const verifyStaff = useCallback(
    async () => {
      if (!supabase) {
        throw new Error(
          'Supabase is not configured.'
        );
      }

      const {
        data: sessionData,
        error: sessionError
      } =
        await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      const user =
        sessionData?.session?.user;

      if (!user) {
        throw new Error(
          'Your staff session could not be verified. Please sign in again.'
        );
      }

      const {
        data: roleRow,
        error: roleError
      } =
        await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();

      if (roleError) {
        throw roleError;
      }

      if (
        !STAFF_ROLES.includes(
          String(
            roleRow?.role || ''
          ).toLowerCase()
        )
      ) {
        throw new Error(
          'This account does not have staff access.'
        );
      }

      return user;
    },
    []
  );

  const loadReviews = useCallback(
    async (silent = false) => {
      if (!supabase) {
        setLoading(false);
        setError(
          'Supabase is not configured.'
        );
        return;
      }

      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError('');

      try {
        await verifyStaff();

        const {
          data,
          error: reviewsError
        } = await supabase
          .from('reviews')
          .select(
            [
              'id',
              'order_id',
              'user_id',
              'service_id',
              'service_name',
              'client_name',
              'client_email',
              'rating',
              'review_text',
              'status',
              'featured',
              'admin_reply',
              'created_at',
              'updated_at'
            ].join(', ')
          )
          .order(
            'created_at',
            {
              ascending: false
            }
          );

        if (reviewsError) {
          throw reviewsError;
        }

        const rows = data || [];

        /*
         * Fill missing client names from profiles.
         */
        const userIds = [
          ...new Set(
            rows
              .map(
                (review) =>
                  review.user_id
              )
              .filter(Boolean)
          )
        ];

        let profileMap = {};

        if (userIds.length) {
          const {
            data: profileRows,
            error: profileError
          } =
            await supabase
              .from('profiles')
              .select(
                'id, name'
              )
              .in(
                'id',
                userIds
              );

          if (
            profileError
          ) {
            console.warn(
              'Review profile lookup error:',
              profileError
            );
          } else {
            profileMap =
              Object.fromEntries(
                (
                  profileRows ||
                  []
                ).map(
                  (profile) => [
                    profile.id,
                    profile
                  ]
                )
              );
          }
        }

        const normalized =
          rows.map(
            (review) => ({
              ...review,
              client_name:
                review.client_name ||
                profileMap[
                  review.user_id
                ]?.name ||
                'Client',
              rating:
                Number(
                  review.rating
                ) || 0,
              status:
                review.status ||
                'pending',
              featured:
                Boolean(
                  review.featured
                )
            })
          );

        setReviews(
          normalized
        );

        setSelectedReview(
          (current) => {
            if (!current) {
              return null;
            }

            return (
              normalized.find(
                (review) =>
                  String(
                    review.id
                  ) ===
                  String(
                    current.id
                  )
              ) ||
              null
            );
          }
        );
      } catch (loadError) {
        console.error(
          'Admin reviews load error:',
          loadError
        );

        setError(
          loadError?.message ||
            'Reviews could not be loaded.'
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [verifyStaff]
  );

  useEffect(() => {
    loadReviews();

    if (!supabase) {
      return undefined;
    }

    const channel =
      supabase
        .channel(
          'admin-reviews-live'
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'reviews'
          },
          (payload) => {
            setConnection(
              'online'
            );

            if (
              payload.eventType ===
              'INSERT'
            ) {
              setReviews(
                (current) => {
                  const exists =
                    current.some(
                      (review) =>
                        String(
                          review.id
                        ) ===
                        String(
                          payload
                            .new
                            ?.id
                        )
                    );

                  if (exists) {
                    return current;
                  }

                  return [
                    payload.new,
                    ...current
                  ];
                }
              );
            }

            if (
              payload.eventType ===
              'UPDATE'
            ) {
              setReviews(
                (current) =>
                  current.map(
                    (review) =>
                      String(
                        review.id
                      ) ===
                      String(
                        payload
                          .new
                          ?.id
                      )
                        ? {
                            ...review,
                            ...payload.new
                          }
                        : review
                  )
              );

              setSelectedReview(
                (current) => {
                  if (
                    !current ||
                    String(
                      current.id
                    ) !==
                      String(
                        payload
                          .new
                          ?.id
                      )
                  ) {
                    return current;
                  }

                  return {
                    ...current,
                    ...payload.new
                  };
                }
              );
            }

            if (
              payload.eventType ===
              'DELETE'
            ) {
              setReviews(
                (current) =>
                  current.filter(
                    (review) =>
                      String(
                        review.id
                      ) !==
                      String(
                        payload
                          .old
                          ?.id
                      )
                  )
              );

              setSelectedReview(
                (current) => {
                  if (
                    current &&
                    String(
                      current.id
                    ) ===
                      String(
                        payload
                          .old
                          ?.id
                      )
                  ) {
                    return null;
                  }

                  return current;
                }
              );
            }
          }
        )
        .subscribe(
          (status) => {
            if (
              status ===
              'SUBSCRIBED'
            ) {
              setConnection(
                'online'
              );
            } else if (
              status ===
                'CHANNEL_ERROR' ||
              status ===
                'TIMED_OUT' ||
              status ===
                'CLOSED'
            ) {
              setConnection(
                'offline'
              );
            } else {
              setConnection(
                'connecting'
              );
            }
          }
        );

    return () => {
      supabase.removeChannel(
        channel
      );
    };
  }, [loadReviews]);

  const serviceOptions =
    useMemo(() => {
      return [
        ...new Set(
          reviews
            .map(
              (review) =>
                review.service_name
            )
            .filter(Boolean)
        )
      ].sort(
        (a, b) =>
          a.localeCompare(b)
      );
    }, [reviews]);

  const stats = useMemo(() => {
    const total =
      reviews.length;

    const published =
      reviews.filter(
        (review) =>
          review.status ===
          'published'
      ).length;

    const pending =
      reviews.filter(
        (review) =>
          review.status ===
          'pending'
      ).length;

    const hidden =
      reviews.filter(
        (review) =>
          review.status ===
          'hidden'
      ).length;

    const featured =
      reviews.filter(
        (review) =>
          Boolean(
            review.featured
          )
      ).length;

    const rated =
      reviews.filter(
        (review) =>
          Number(
            review.rating
          ) > 0
      );

    const average =
      rated.length
        ? rated.reduce(
            (
              totalRating,
              review
            ) =>
              totalRating +
              Number(
                review.rating
              ),
            0
          ) / rated.length
        : 0;

    return {
      total,
      published,
      pending,
      hidden,
      featured,
      average
    };
  }, [reviews]);

  const filteredReviews =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return reviews.filter(
        (review) => {
          const searchable =
            [
              review.client_name,
              review.client_email,
              review.service_name,
              review.review_text,
              review.order_id
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase();

          const matchesSearch =
            !query ||
            searchable.includes(
              query
            );

          const matchesStatus =
            statusFilter ===
              'all' ||
            String(
              review.status ||
                ''
            ).toLowerCase() ===
              statusFilter;

          const matchesRating =
            ratingFilter ===
              'all' ||
            String(
              review.rating
            ) ===
              ratingFilter;

          const matchesService =
            serviceFilter ===
              'all' ||
            review.service_name ===
              serviceFilter;

          return (
            matchesSearch &&
            matchesStatus &&
            matchesRating &&
            matchesService
          );
        }
      );
    }, [
      reviews,
      search,
      statusFilter,
      ratingFilter,
      serviceFilter
    ]);

  async function updateReview(
    reviewId,
    changes,
    successMessage
  ) {
    if (!supabase) {
      return;
    }

    setSavingId(
      reviewId
    );
    setError('');
    setNotice('');

    try {
      await verifyStaff();

      const {
        data,
        error: updateError
      } =
        await supabase
          .from('reviews')
          .update({
            ...changes,
            updated_at:
              new Date().toISOString()
          })
          .eq(
            'id',
            reviewId
          )
          .select(
            [
              'id',
              'order_id',
              'user_id',
              'service_id',
              'service_name',
              'client_name',
              'client_email',
              'rating',
              'review_text',
              'status',
              'featured',
              'admin_reply',
              'created_at',
              'updated_at'
            ].join(', ')
          )
          .single();

      if (updateError) {
        throw updateError;
      }

      setReviews(
        (current) =>
          current.map(
            (review) =>
              String(
                review.id
              ) ===
              String(
                reviewId
              )
                ? {
                    ...review,
                    ...data
                  }
                : review
          )
      );

      setSelectedReview(
        (current) =>
          current &&
          String(
            current.id
          ) ===
            String(
              reviewId
            )
            ? {
                ...current,
                ...data
              }
            : current
      );

      setNotice(
        successMessage ||
          'Review updated.'
      );
    } catch (updateError) {
      console.error(
        'Admin review update error:',
        updateError
      );

      setError(
        updateError?.message ||
          'The review could not be updated.'
      );
    } finally {
      setSavingId(null);
    }
  }

  async function handleStatusChange(
    reviewId,
    status
  ) {
    await updateReview(
      reviewId,
      {
        status
      },
      `Review marked ${formatStatus(
        status
      ).toLowerCase()}.`
    );
  }

  async function handleFeaturedChange(
    reviewId,
    featured
  ) {
    await updateReview(
      reviewId,
      {
        featured
      },
      featured
        ? 'Review added to featured reviews.'
        : 'Review removed from featured reviews.'
    );
  }

  async function handleReply(
    reviewId,
    reply
  ) {
    await updateReview(
      reviewId,
      {
        admin_reply:
          reply || null
      },
      reply
        ? 'Admin reply saved.'
        : 'Admin reply removed.'
    );
  }

  async function deleteReview(
    review
  ) {
    if (!review) {
      return;
    }

    const confirmed =
      window.confirm(
        `Delete this review from ${review.client_name || 'this client'}? This cannot be undone.`
      );

    if (!confirmed) {
      return;
    }

    setSavingId(
      review.id
    );
    setError('');
    setNotice('');

    try {
      await verifyStaff();

      const {
        error: deleteError
      } =
        await supabase
          .from('reviews')
          .delete()
          .eq(
            'id',
            review.id
          );

      if (deleteError) {
        throw deleteError;
      }

      setReviews(
        (current) =>
          current.filter(
            (item) =>
              String(
                item.id
              ) !==
              String(
                review.id
              )
          )
      );

      setSelectedReview(
        null
      );

      setNotice(
        'Review deleted.'
      );
    } catch (deleteError) {
      console.error(
        'Admin review delete error:',
        deleteError
      );

      setError(
        deleteError?.message ||
          'The review could not be deleted.'
      );
    } finally {
      setSavingId(null);
    }
  }

  function clearFilters() {
    setSearch('');
    setStatusFilter('all');
    setRatingFilter('all');
    setServiceFilter('all');
  }

  return (
    <DashboardShell admin>
      <main className="admin-reviews-page">
        <header className="admin-reviews-head">
          <div>
            <p className="eyebrow">
              ADMIN · REVIEWS
            </p>

            <h1>
              Client reviews.
            </h1>

            <p>
              Review customer feedback,
              control visibility, feature
              standout feedback and reply
              from the team.
            </p>
          </div>

          <div className="admin-reviews-head-actions">
            <span
              className={`admin-reviews-live ${connection}`}
            >
              <i />
              {connection ===
              'online'
                ? 'LIVE'
                : connection ===
                  'offline'
                ? 'OFFLINE'
                : 'CONNECTING'}
            </span>

            <button
              type="button"
              className="admin-review-secondary-btn"
              onClick={() =>
                loadReviews(true)
              }
              disabled={
                loading ||
                refreshing
              }
            >
              {refreshing
                ? 'Refreshing…'
                : 'Refresh ↻'}
            </button>
          </div>
        </header>

        {error && (
          <div
            className="admin-review-notice error"
            role="alert"
          >
            <strong>
              Reviews could not be loaded.
            </strong>

            <span>{error}</span>

            <button
              type="button"
              onClick={() =>
                loadReviews(false)
              }
            >
              Try again
            </button>
          </div>
        )}

        {notice && (
          <div
            className="admin-review-notice success"
            role="status"
          >
            <span>{notice}</span>

            <button
              type="button"
              onClick={() =>
                setNotice('')
              }
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        )}

        <section className="admin-review-stats">
          <StatCard
            label="Total reviews"
            value={
              loading
                ? '—'
                : stats.total
            }
            detail="All customer feedback"
          />

          <StatCard
            label="Average rating"
            value={
              loading
                ? '—'
                : `${stats.average.toFixed(
                    1
                  )}/5`
            }
            detail="Across rated reviews"
            accent="rating"
          />

          <StatCard
            label="Published"
            value={
              loading
                ? '—'
                : stats.published
            }
            detail="Visible on the site"
            accent="published"
          />

          <StatCard
            label="Pending"
            value={
              loading
                ? '—'
                : stats.pending
            }
            detail="Waiting for review"
            accent="pending"
          />

          <StatCard
            label="Featured"
            value={
              loading
                ? '—'
                : stats.featured
            }
            detail="Highlighted feedback"
            accent="featured"
          />
        </section>

        <section className="admin-review-toolbar panel">
          <label className="admin-review-search">
            <span>⌕</span>

            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search client, service or review…"
              aria-label="Search reviews"
            />
          </label>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value
              )
            }
            aria-label="Filter reviews by status"
          >
            <option value="all">
              All statuses
            </option>

            {REVIEW_STATUSES.map(
              (status) => (
                <option
                  value={status}
                  key={status}
                >
                  {formatStatus(
                    status
                  )}
                </option>
              )
            )}
          </select>

          <select
            value={ratingFilter}
            onChange={(event) =>
              setRatingFilter(
                event.target.value
              )
            }
            aria-label="Filter reviews by rating"
          >
            {RATING_OPTIONS.map(
              (rating) => (
                <option
                  value={rating}
                  key={rating}
                >
                  {rating === 'all'
                    ? 'All ratings'
                    : `${rating} star${
                        rating === '1'
                          ? ''
                          : 's'
                      }`}
                </option>
              )
            )}
          </select>

          <select
            value={serviceFilter}
            onChange={(event) =>
              setServiceFilter(
                event.target.value
              )
            }
            aria-label="Filter reviews by service"
          >
            <option value="all">
              All services
            </option>

            {serviceOptions.map(
              (service) => (
                <option
                  value={service}
                  key={service}
                >
                  {service}
                </option>
              )
            )}
          </select>

          <button
            type="button"
            className="admin-review-clear-btn"
            onClick={clearFilters}
          >
            Clear
          </button>
        </section>

        <section className="admin-review-list-panel panel">
          <div className="admin-review-list-head">
            <div>
              <p className="admin-review-kicker">
                REVIEW DIRECTORY
              </p>

              <h2>
                {loading
                  ? 'Loading reviews…'
                  : `${filteredReviews.length} review${
                      filteredReviews.length ===
                      1
                        ? ''
                        : 's'
                    } shown`}
              </h2>
            </div>

            <span>
              {stats.hidden} hidden
            </span>
          </div>

          {loading ? (
            <div className="admin-review-empty">
              <div className="admin-review-loading-icon">
                …
              </div>

              <h3>
                Loading customer feedback…
              </h3>

              <p>
                Fetching reviews from
                Supabase.
              </p>
            </div>
          ) : !filteredReviews.length ? (
            <div className="admin-review-empty">
              <div className="admin-review-empty-icon">
                ☆
              </div>

              <h3>
                No reviews found.
              </h3>

              <p>
                Try changing your filters
                or clear the search.
              </p>

              <button
                type="button"
                className="admin-review-primary-btn"
                onClick={
                  clearFilters
                }
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="admin-review-list">
              {filteredReviews.map(
                (review) => {
                  const isSaving =
                    String(
                      savingId
                    ) ===
                    String(
                      review.id
                    );

                  return (
                    <article
                      className="admin-review-card"
                      key={
                        review.id
                      }
                    >
                      <div className="admin-review-card-main">
                        <div className="admin-review-card-client">
                          <div className="admin-review-avatar">
                            {getInitials(
                              review.client_name ||
                                'Client'
                            )}
                          </div>

                          <div>
                            <strong>
                              {review.client_name ||
                                'Client'}
                            </strong>

                            <span>
                              {review.client_email ||
                                'Client'}
                            </span>
                          </div>
                        </div>

                        <div className="admin-review-card-rating">
                          <RatingStars
                            rating={
                              review.rating
                            }
                          />

                          <strong>
                            {review.rating ||
                              0}
                            /5
                          </strong>
                        </div>

                        <div className="admin-review-card-content">
                          <div className="admin-review-card-service">
                            <strong>
                              {review.service_name ||
                                'Careerlyst service'}
                            </strong>

                            <span>
                              Order #
                              {review.order_id ||
                                '—'}
                            </span>
                          </div>

                          <p>
                            {review.review_text ||
                              'No review text provided.'}
                          </p>

                          {review.admin_reply && (
                            <div className="admin-review-reply-preview">
                              <span>
                                Team reply
                              </span>

                              <p>
                                {
                                  review.admin_reply
                                }
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="admin-review-card-meta">
                          <span
                            className={`admin-review-status ${getStatusClass(
                              review.status
                            )}`}
                          >
                            {formatStatus(
                              review.status
                            )}
                          </span>

                          {review.featured && (
                            <span className="admin-review-featured-badge">
                              ★ Featured
                            </span>
                          )}

                          <time>
                            {formatDate(
                              review.created_at
                            )}
                          </time>
                        </div>

                        <div className="admin-review-card-actions">
                          <button
                            type="button"
                            className="admin-review-action primary"
                            onClick={() =>
                              setSelectedReview(
                                review
                              )
                            }
                          >
                            Manage
                          </button>

                          {review.status !==
                            'published' && (
                            <button
                              type="button"
                              className="admin-review-action"
                              disabled={
                                isSaving
                              }
                              onClick={() =>
                                handleStatusChange(
                                  review.id,
                                  'published'
                                )
                              }
                            >
                              Publish
                            </button>
                          )}

                          {review.status ===
                            'published' && (
                            <button
                              type="button"
                              className="admin-review-action"
                              disabled={
                                isSaving
                              }
                              onClick={() =>
                                handleStatusChange(
                                  review.id,
                                  'hidden'
                                )
                              }
                            >
                              Hide
                            </button>
                          )}

                          <button
                            type="button"
                            className="admin-review-action danger"
                            disabled={
                              isSaving
                            }
                            onClick={() =>
                              deleteReview(
                                review
                              )
                            }
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                }
              )}
            </div>
          )}
        </section>

        {selectedReview && (
          <ReviewDrawer
            review={
              selectedReview
            }
            onClose={() =>
              setSelectedReview(
                null
              )
            }
            onStatusChange={
              handleStatusChange
            }
            onFeaturedChange={
              handleFeaturedChange
            }
            onReply={
              handleReply
            }
            saving={
              savingId != null
            }
          />
        )}
      </main>
    </DashboardShell>
  );
}

/*
 * IMPORTANT:
 * Admin.jsx imports this component as:
 *
 * import AdminReviewsPage from './AdminReviews';
 *
 * Therefore this DEFAULT export is required.
 */
export default AdminReviewsPage;

/*
 * Named export is also provided so the component can be imported
 * either way in the future.
 */
export {
  AdminReviewsPage,
  AdminReviewsPage as AdminReviews
};