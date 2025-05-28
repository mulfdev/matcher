import { useEffect, useState } from 'react';
import { fetcher } from '~/core';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '~/components/card';
import { Text } from '~/components/text';
import { Button } from '~/components/button';
import { HandThumbUpIcon, HandThumbDownIcon } from '@heroicons/react/24/solid';
import clsx from 'clsx';

interface JobMatch {
  id: string;
  title: string;
  location: string;
  compensation: string;
  summary: string;
  reason?: string;
  similarity?: number;
}

interface MatchResponse {
  results: JobMatch[];
}

function MatchesSkeletonCard() {
  return (
    <div
      className={clsx(
        'overflow-hidden border-2 border-zinc-800 shadow-xl relative group',
        'bg-gradient-to-br from-zinc-900/80 via-zinc-950/90 to-purple-950/60',
        'animate-pulse',
        'rounded-2xl',
        'sm:p-0 p-2'
      )}
      style={{
        boxShadow: '0 4px 32px 0 rgba(168,85,247,0.10)',
      }}
    >
      <div className="absolute right-0 top-0 m-2 sm:m-4">
        <span className="inline-block rounded-full bg-gradient-to-tr from-purple-500 via-pink-400 to-indigo-400 px-2 py-1 sm:px-3 sm:py-1 text-xs font-bold text-white shadow-md opacity-60">
          &nbsp;
        </span>
      </div>
      <div className="pb-2 px-3 pt-4 sm:px-6 sm:pt-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div className="w-full">
            <div className="h-5 sm:h-6 w-32 sm:w-40 bg-zinc-800 rounded mb-2" />
            <div className="flex flex-wrap items-center mt-1 text-zinc-400 text-xs sm:text-sm gap-2">
              <div className="h-4 w-20 sm:w-24 bg-zinc-800 rounded" />
              <div className="mx-2 h-4 w-2 bg-zinc-800 rounded hidden sm:inline" />
              <div className="h-4 w-16 sm:w-20 bg-zinc-800 rounded" />
            </div>
          </div>
        </div>
      </div>
      <div className="px-3 sm:px-6 pb-3 sm:pb-4">
        <div className="h-4 w-full bg-zinc-800 rounded mb-2" />
        <div className="h-4 w-3/4 bg-zinc-800 rounded mb-2" />
        <div className="h-4 w-1/2 bg-zinc-800 rounded" />
        <div className="mt-3 sm:mt-4 rounded-lg bg-gradient-to-r from-purple-900/60 to-zinc-900/60 px-3 sm:px-4 py-2.5 sm:py-3 shadow-inner border border-purple-800 flex items-start gap-2 opacity-60">
          <div className="h-5 w-5 bg-purple-800 rounded-full mr-2" />
          <div className="flex-1">
            <div className="h-3 w-20 sm:w-24 bg-purple-800 rounded mb-1" />
            <div className="h-3 w-24 sm:w-32 bg-purple-800 rounded" />
          </div>
        </div>
      </div>
      <div className="border-t border-zinc-800 bg-zinc-900/60 flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-0 px-2 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center space-x-2 mb-2 sm:mb-0">
          <div className="h-9 w-9 sm:h-10 sm:w-10 bg-green-900/40 rounded-lg" />
          <div className="h-9 w-9 sm:h-10 sm:w-10 bg-rose-900/40 rounded-lg" />
        </div>
        <div className="h-8 w-full sm:w-24 bg-indigo-900/40 rounded" />
      </div>
    </div>
  );
}

export default function DashboardMatches() {
  const [matches, setMatches] = useState<JobMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submittingFeedbackFor, setSubmittingFeedbackFor] = useState<string | null>(null);
  const [feedbackMap, setFeedbackMap] = useState<Record<string, boolean>>({});
  const [totalRated, setTotalRated] = useState(0);
  const [hoveredThumb, setHoveredThumb] = useState<{ id: string; type: 'up' | 'down' } | null>(null);
  const MAX_TOTAL = 21;

  const fetchMatches = async () => {
    try {
      setLoading(true);
      const response = await fetcher<MatchResponse>({ url: '/match-job' });
      setMatches(response.results);
    } catch (err) {
      console.error('Error fetching matches:', err);
      setError('Failed to load job matches. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatches();
  }, []);

  useEffect(() => {
    if (!loading && matches.length > 0 && Object.keys(feedbackMap).length === matches.length) {
      const newTotal = totalRated + matches.length;
      if (newTotal < MAX_TOTAL) {
        setTotalRated(newTotal);
        setFeedbackMap({});
        fetchMatches();
      } else {
        setTotalRated(newTotal);
      }
    }
  }, [feedbackMap, loading, matches, totalRated]);

  // Function to format compensation
  const formatCompensation = (compensation: string) => {
    if (!compensation) return 'Not specified';
    return compensation;
  };

  return (
    <div className="max-w-4xl mx-auto p-2 md:p-6">
      <h1 className="text-white text-3xl sm:text-4xl font-extrabold mb-6 sm:mb-8 tracking-tight flex items-center gap-2 sm:gap-3">
        <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400 bg-clip-text text-transparent drop-shadow-lg">
          Your Job Matches
        </span>
        <span className="inline-block animate-bounce text-xl sm:text-2xl">✨</span>
      </h1>

      {loading ? (
        <div className="space-y-6 sm:space-y-8">
          {[...Array(3)].map((_, i) => (
            <MatchesSkeletonCard key={i} />
          ))}
        </div>
      ) : error ? (
        <Card className="bg-gradient-to-r from-red-900/40 to-zinc-900/40 border-red-800 shadow-lg">
          <CardContent className="pt-6">
            <Text className="text-red-300">{error}</Text>
          </CardContent>
        </Card>
      ) : totalRated >= MAX_TOTAL ? (
        <Card className="bg-gradient-to-r from-zinc-900/60 to-purple-900/40 border-purple-800 shadow-lg">
          <CardContent className="pt-6 flex flex-col items-center">
            <span className="text-5xl mb-2">🎉</span>
            <Text className="text-lg text-white font-semibold">
              You’ve reviewed all {MAX_TOTAL} job recommendations.
            </Text>
            <Text className="text-zinc-400 mt-2">Check back soon for more opportunities!</Text>
          </CardContent>
        </Card>
      ) : matches.length === 0 ? (
        <Card className="bg-gradient-to-r from-zinc-900/60 to-purple-900/40 border-purple-800 shadow-lg">
          <CardContent className="pt-6 flex flex-col items-center">
            <span className="text-4xl mb-2">🔍</span>
            <Text className="text-lg text-white font-semibold">No job matches found.</Text>
            <Text className="text-zinc-400 mt-2">
              Please complete your profile to get matched with jobs.
            </Text>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6 sm:space-y-8">
          {matches.map((job, idx) => (
            <Card
              key={job.id}
              className={clsx(
                'overflow-hidden border-2 border-zinc-800 hover:border-purple-500 transition-colors duration-300 shadow-xl relative group',
                'bg-gradient-to-br from-zinc-900/80 via-zinc-950/90 to-purple-950/60',
                'rounded-2xl',
                'sm:p-0 p-2'
              )}
              style={{
                boxShadow:
                  idx % 2 === 0
                    ? '0 4px 32px 0 rgba(168,85,247,0.10)'
                    : '0 4px 32px 0 rgba(99,102,241,0.10)',
              }}
            >
              <div className="absolute right-0 top-0 m-2 sm:m-4">
                <span className="hidden sm:inline-block rounded-full bg-gradient-to-tr from-purple-500 via-pink-400 to-indigo-400 px-2 py-1 sm:px-3 sm:py-1 text-xs font-bold text-white shadow-md">
                  Match #{idx + 1}
                </span>
              </div>
              <CardHeader className="pb-2">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div className="w-full">
                    <CardTitle className="text-lg sm:text-3xl text-white font-extrabold flex items-center gap-2 sm:gap-4">
                      <span>{job.title}</span>
                      <span className="text-purple-400 text-base sm:text-xl font-semibold">
                        {job.similarity && job.similarity > 0
                          ? `• ${Math.round(job.similarity * 100)}%`
                          : ''}
                      </span>
                    </CardTitle>
                    <div className="flex flex-wrap items-center mt-1 text-zinc-400 text-xs sm:text-base gap-2 sm:gap-4">
                      <span className="flex items-center gap-1">
                        <svg
                          className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                        >
                          <path d="M17.657 16.657L13.414 12.414a4 4 0 1 0-1.414 1.414l4.243 4.243a1 1 0 0 0 1.414-1.414z"></path>
                          <path d="M15 11a4 4 0 1 1-8 0 4 4 0 0 1 8 0z"></path>
                        </svg>
                        {job.location || (
                          <span className="italic text-zinc-500">Remote / Flexible</span>
                        )}
                      </span>
                      {job.compensation && (
                        <>
                          <span className="mx-2 hidden sm:inline">•</span>
                          <span className="flex items-center gap-1">
                            <svg
                              className="w-4 h-4 sm:w-5 sm:h-5 text-green-400"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              viewBox="0 0 24 24"
                            >
                              <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 10c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z"></path>
                            </svg>
                            {formatCompensation(job.compensation)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Text className="line-clamp-4 text-zinc-200 text-sm sm:text-base leading-relaxed">
                  {job.summary}
                </Text>
                {job.reason && (
                  <div className="mt-3 sm:mt-4 rounded-lg bg-gradient-to-r from-purple-900/60 to-zinc-900/60 px-2.5 sm:px-6 py-2 sm:py-4 shadow-inner border border-purple-800">
                    {/* Desktop layout: icon, label, and reason in a row, with improved spacing and visual hierarchy */}
                    <div className="hidden sm:flex items-start gap-4">
                      <div className="flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-full bg-purple-950/60 border border-purple-800 mr-2">
                        <svg
                          className="w-6 h-6 text-purple-300"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                        >
                          <path d="M13 16h-1v-4h-1m1-4h.01M12 20a8 8 0 1 1 0-16 8 8 0 0 1 0 16z"></path>
                        </svg>
                      </div>
                      <div>
                        <div className="font-bold text-purple-200 text-lg mb-1">Why this match</div>
                        <div className="text-purple-100 text-base leading-relaxed">{job.reason}</div>
                      </div>
                    </div>
                    {/* Mobile layout: icon and label in a row, reason below */}
                    <div className="flex sm:hidden flex-col w-full">
                      <div className="flex items-center gap-2 mb-1">
                        <svg
                          className="w-5 h-5 text-purple-400 flex-shrink-0"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                        >
                          <path d="M13 16h-1v-4h-1m1-4h.01M12 20a8 8 0 1 1 0-16 8 8 0 0 1 0 16z"></path>
                        </svg>
                        <span className="font-semibold text-purple-200 text-sm">Why this match:</span>
                      </div>
                      <span className="text-purple-100 text-sm">{job.reason}</span>
                    </div>
                  </div>
                )}
              </CardContent>
              <CardFooter className="border-t border-zinc-800 bg-zinc-900/60 flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-0 px-2 sm:px-6 py-3 sm:py-4">
                <div className="flex items-center space-x-2 mb-2 sm:mb-0">
                  {/* Thumbs Up Button */}
                  <button
                    disabled={submittingFeedbackFor === job.id}
                    className={clsx(
                      'relative rounded-lg p-2 sm:p-3 transition-all duration-200 group',
                      'bg-gradient-to-br from-green-500/90 via-emerald-500/80 to-indigo-400/70',
                      'hover:from-green-700 hover:to-indigo-300 hover:scale-110',
                      feedbackMap[job.id] === true
                        ? 'ring-4 ring-green-400 border-green-400 scale-110'
                        : 'border-transparent',
                      submittingFeedbackFor === job.id && 'opacity-60 cursor-not-allowed'
                    )}
                    aria-label="Like"
                    onMouseEnter={() => setHoveredThumb({ id: job.id, type: 'up' })}
                    onMouseLeave={() => setHoveredThumb(null)}
                    onClick={() => {
                      setError(null);
                      setSubmittingFeedbackFor(job.id);
                      fetcher({
                        method: 'POST',
                        url: '/match-job/feedback',
                        body: { id: job.id, liked: true },
                      })
                        .catch((err) => {
                          console.error('Error submitting feedback:', err);
                          setError('Failed to submit feedback. Please try again.');
                        })
                        .finally(() => {
                          setSubmittingFeedbackFor(null);
                          setFeedbackMap((prev) => ({ ...prev, [job.id]: true }));
                        });
                    }}
                  >
                    <HandThumbUpIcon
                      className={clsx(
                        'w-5 h-5 sm:w-5.5 sm:h-5.5 transition-colors duration-150',
                        feedbackMap[job.id] === true
                          ? 'text-white'
                          : (hoveredThumb?.id === job.id && hoveredThumb?.type === 'up')
                            ? 'text-white'
                            : 'text-green-900'
                      )}
                      aria-hidden="true"
                    />
                  </button>
                  {/* Thumbs Down Button */}
                  <button
                    disabled={submittingFeedbackFor === job.id}
                    className={clsx(
                      'relative rounded-lg p-2 sm:p-3 transition-all duration-200 group',
                      'bg-gradient-to-br from-rose-500/90 via-pink-500/80 to-indigo-400/70',
                      'hover:from-rose-700 hover:to-indigo-300 hover:scale-110',
                      feedbackMap[job.id] === false
                        ? 'ring-4 ring-rose-400 border-rose-400 scale-110'
                        : 'border-transparent',
                      submittingFeedbackFor === job.id && 'opacity-60 cursor-not-allowed'
                    )}
                    aria-label="Dislike"
                    onMouseEnter={() => setHoveredThumb({ id: job.id, type: 'down' })}
                    onMouseLeave={() => setHoveredThumb(null)}
                    onClick={() => {
                      setError(null);
                      setSubmittingFeedbackFor(job.id);
                      fetcher({
                        method: 'POST',
                        url: '/match-job/feedback',
                        body: { id: job.id, liked: false },
                      })
                        .catch((err) => {
                          console.error('Error submitting feedback:', err);
                          setError('Failed to submit feedback. Please try again.');
                        })
                        .finally(() => {
                          setSubmittingFeedbackFor(null);
                          setFeedbackMap((prev) => ({ ...prev, [job.id]: false }));
                        });
                    }}
                  >
                    <HandThumbDownIcon
                      className={clsx(
                        'w-5 h-5 sm:w-5.5 sm:h-5.5 transition-colors duration-150',
                        feedbackMap[job.id] === false
                          ? 'text-white'
                          : (hoveredThumb?.id === job.id && hoveredThumb?.type === 'down')
                            ? 'text-white'
                            : 'text-rose-900'
                      )}
                      aria-hidden="true"
                    />
                  </button>
                </div>
                <Button
                  color="indigo"
                  className="w-full sm:w-auto font-semibold shadow-md hover:scale-105 transition-transform duration-150"
                >
                  View Details
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
