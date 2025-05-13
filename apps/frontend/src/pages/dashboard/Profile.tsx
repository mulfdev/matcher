import { useState, useEffect } from 'react';
import { Button } from '~/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/card';
import { Input } from '~/components/input';
import { Text } from '~/components/text';
import { fetcher } from '~/core';
import ResumeViz from './ResumeVis';
import type { ResumeData } from '~/types';

interface UserProfile {
  email: string;
  name: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  github?: string;
}

export default function Profile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [resumeData, setResumeData] = useState<ResumeData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<UserProfile | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        // Fetch user profile data
        const profileData = await fetcher<UserProfile>({ url: '/auth/me' });
        setProfile(profileData);
        setFormData(profileData);

        try {
          const resume = await fetcher<{ data: ResumeData }>({ url: '/resume' });
          setResumeData(resume.data);
        } catch {
          console.log('No resume data available');
        }
      } catch (error) {
        console.error('Error fetching profile data:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => (prev ? { ...prev, [name]: value } : null));
  };

  const handleSave = async () => {
    if (!formData) return;

    try {
      setIsSaving(true);
      await fetcher({
        url: '/profile',
        method: 'POST',
        body: formData,
      });
      setProfile(formData);
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving profile:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-2 md:p-6">
        <div className="flex justify-center items-center h-64">
          <div className="animate-pulse text-purple-400">Loading profile data...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-2 md:p-6">
      <h1 className="text-white text-3xl font-bold mb-6">Your Profile</h1>

      <div className="grid grid-cols-1 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Profile Information</CardTitle>
            {!isEditing ? (
              <Button color="purple" onClick={() => setIsEditing(true)}>
                Edit Profile
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  color="zinc"
                  onClick={() => {
                    setIsEditing(false);
                    setFormData(profile);
                  }}
                >
                  Cancel
                </Button>
                <Button color="purple" onClick={handleSave} disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {!isEditing ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Name</h3>
                    <p className="mt-1 text-base text-zinc-950 dark:text-white">{profile?.name}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Email</h3>
                    <p className="mt-1 text-base text-zinc-950 dark:text-white">{profile?.email}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Phone</h3>
                    <p className="mt-1 text-base text-zinc-950 dark:text-white">
                      {profile?.phone || 'Not provided'}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                      Location
                    </h3>
                    <p className="mt-1 text-base text-zinc-950 dark:text-white">
                      {profile?.location || 'Not provided'}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                      LinkedIn
                    </h3>
                    <p className="mt-1 text-base text-zinc-950 dark:text-white">
                      {profile?.linkedin || 'Not provided'}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">GitHub</h3>
                    <p className="mt-1 text-base text-zinc-950 dark:text-white">
                      {profile?.github || 'Not provided'}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="name"
                      className="block text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1"
                    >
                      Name
                    </label>
                    <Input
                      id="name"
                      name="name"
                      value={formData?.name || ''}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="email"
                      className="block text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1"
                    >
                      Email
                    </label>
                    <Input id="email" name="email" value={formData?.email || ''} disabled />
                    <Text className="text-xs mt-1">Email cannot be changed (Google Sign-in)</Text>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="phone"
                      className="block text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1"
                    >
                      Phone
                    </label>
                    <Input
                      id="phone"
                      name="phone"
                      value={formData?.phone || ''}
                      onChange={handleInputChange}
                      placeholder="Your phone number"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="location"
                      className="block text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1"
                    >
                      Location
                    </label>
                    <Input
                      id="location"
                      name="location"
                      value={formData?.location || ''}
                      onChange={handleInputChange}
                      placeholder="City, State"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="linkedin"
                      className="block text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1"
                    >
                      LinkedIn
                    </label>
                    <Input
                      id="linkedin"
                      name="linkedin"
                      value={formData?.linkedin || ''}
                      onChange={handleInputChange}
                      placeholder="LinkedIn profile URL"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="github"
                      className="block text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1"
                    >
                      GitHub
                    </label>
                    <Input
                      id="github"
                      name="github"
                      value={formData?.github || ''}
                      onChange={handleInputChange}
                      placeholder="GitHub profile URL"
                    />
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {resumeData && (
        <div className="mt-8">
          <h2 className="text-white text-2xl font-bold mb-4">Resume Information</h2>
          <ResumeViz data={resumeData} />
        </div>
      )}
    </div>
  );
}
