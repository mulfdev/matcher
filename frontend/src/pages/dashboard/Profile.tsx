import { useState, useEffect } from 'react';
import { fetcher } from '~/core';
import ResumeViz from './ResumeVis';
import type { ResumeData } from '~/types';

export default function Profile() {
  const [resumeData, setResumeData] = useState<ResumeData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchProfile() {
      try {
        setIsLoading(true);
        const res = await fetcher<{ data: ResumeData }>({ url: '/profile' });
        setResumeData(res.data);
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchProfile();
  }, []);

  console.log(resumeData);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-2 md:p-6">
        <div className="flex justify-center items-center h-64">
          <div className="animate-pulse text-purple-400">Loading profile data...</div>
        </div>
      </div>
    );
  }

  if (!resumeData) {
    return (
      <div className="max-w-4xl mx-auto p-2 md:p-6">
        <h1 className="text-white text-3xl font-bold mb-6">Your Profile</h1>
        <p className="text-white">No profile found. Upload your resume first.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-2 md:p-6">
      <h1 className="text-white text-3xl font-bold mb-6">Your Profile</h1>
      <ResumeViz data={resumeData} />
    </div>
  );
}
