import { useState, useEffect } from 'react';
import { Badge } from '~/components/badge';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/card';
import { Text } from '~/components/text';

type Skill = string;

type Experience = {
  company: string;
  duration_months: number;
  end_date: string;
  responsibilities: string[];
  start_date: string;
  title: string;
};

type ResumeData = {
  data: {
    skills: Skill[];
    experience: Experience[];
    total_experience_years: number;
    career_level: string;
    category: string;
    summary: string;
  };
};

// Skill categories for grouping
const skillCategories = {
  frontend: [
    'Typescript',
    'CSS',
    'Tailwind',
    'React',
    'Next.js',
    'SSR',
    'SSG',
    'Styled Components',
    'Cypress',
  ],
  backend: [
    'Node.js',
    'Express',
    'Go',
    'SQL',
    'Postgres',
    'MySQL',
    'MongoDB',
    'REST APIs',
    'WebSockets',
    'Jest',
  ],
  cloud: [
    'AWS CDK',
    'AWS Lambda',
    'AWS SQS',
    'AWS RDS',
    'AWS ECS',
    'AWS API Gateway',
    'DynamoDB',
    'AWS S3',
    'Digital Ocean',
    'Vercel',
    'CI/CD',
  ],
  blockchain: [
    'Solidity',
    'Hardhat',
    'Foundry',
    'Ethers.js',
    'Wagmi',
    'Blockchain APIs',
    'Smart Contract Development',
    'Hyperlane',
    'Ethereum',
    'Treasure Chain',
    'Solana',
    'NFT',
    'Subgraphs',
    'Mainnet',
  ],
  other: ['GitHub', 'DNS', 'Figma', 'Kafka'],
};

export default function ResumeViz() {
  const [resumeData, setResumeData] = useState<ResumeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulating data fetch - in a real app, you would fetch from your API
    const mockData: ResumeData = {
      data: {
        skills: [
          'Typescript',
          'Node.js',
          'CSS',
          'Tailwind',
          'React',
          'Next.js',
          'SSR',
          'SSG',
          'API Routes',
          'Go',
          'SQL',
          'Postgres',
          'MySQL',
          'AWS CDK',
          'AWS Lambda',
          'AWS SQS',
          'AWS RDS',
          'Kafka',
          'AWS ECS',
          'Solidity',
          'Hardhat',
          'Foundry',
          'Ethers.js',
          'Wagmi',
          'Blockchain APIs',
          'Smart Contract Development',
          'Figma',
          'Arbitrum',
          'AWS API Gateway',
          'DynamoDB',
          'Subgraphs',
          'AWS S3',
          'NFT',
          'Hyperlane',
          'Ethereum',
          'Treasure Chain',
          'Solana',
          'Digital Ocean',
          'Vercel',
          'CI/CD',
          'GitHub',
          'DNS',
          'Mainnet',
          'REST APIs',
          'Styled Components',
          'Cypress',
          'Express',
          'MongoDB',
          'Jest',
          'WebSockets',
        ],
        experience: [
          {
            company: 'Treasure',
            duration_months: 29,
            end_date: 'Present',
            responsibilities: [
              'Transforming Figma designs into responsive frontend code using Next.js, integrating with backend systems and live contracts on Arbitrum.',
              'Maintain and update backend architecture using AWS Lambda, API Gateway, DynamoDB, Subgraphs, SQS, RDS, and S3, ensuring seamless data delivery to the frontend.',
              'Contribute to a NFT marketplace and platform that has facilitated $275M in transaction volume',
              'Achieved approximately 10% cost reduction in backend operations through strategic refactoring of data fetching processes.',
              'Leading ecosystem migration working with partners to migrate assets from Arbitrum to Treasure Chain providing hands on support and guiding new contract implementations',
              'Championed SmolCoin migration by developing new token contracts with Hyperlane cross chain integration launching on Ethereum, Treasure Chain, and Solana',
            ],
            start_date: '2023-01',
            title: 'Full Stack Engineer',
          },
          {
            company: 'Developer DAO',
            duration_months: 12,
            end_date: '2023-01',
            responsibilities: [
              'Spearheaded the launch of Season 1, leading the development of the Developer DAO website.',
              'Architected and implemented the entire software stack, encompassing Postgres, S3, Node.js, Digital Ocean, Vercel, and CI/CD pipelines.',
              'Researched and implemented a comprehensive GitHub strategy to bolster security, cloud infrastructure management, deployments, DNS, and platform engineering.',
            ],
            start_date: '2022-02',
            title: 'Lead Full Stack Engineer',
          },
          {
            company: 'Hyype, Inc',
            duration_months: 12,
            end_date: '2022-01',
            responsibilities: [
              'Developed user interface components with React and Next.js, enabling interaction with REST APIs and live contracts on Mainnet.',
              'Designed and implemented a custom component system leveraging Styled Components.',
              'Collaborated closely with the Backend Team to develop contracts and API data models.',
              'Enhanced front-end performance by 20%, focusing on code splitting and optimized image handling.',
              'Conducted comprehensive end-to-end testing using Cypress.',
            ],
            start_date: '2021-02',
            title: 'Front-End Engineer',
          },
          {
            company: 'SevenStar, Inc',
            duration_months: 12,
            end_date: '2021-01',
            responsibilities: [
              'Designed and implemented client-side and server-side architecture.',
              'Developed engaging and functional front-end interfaces using Next.js.',
              'Created and maintained a REST API using Express backed by MongoDB.',
              'Ensured software quality through rigorous testing with Cypress and Jest.',
              'Collaborated with data scientists and analysts to refine and improve software functionalities.',
            ],
            start_date: '2020-02',
            title: 'Full Stack Engineer',
          },
        ],
        total_experience_years: 5.1,
        career_level: 'senior',
        category: 'engineer/developer',
        summary:
          'Mulf is a Senior Full Stack Engineer with over 5 years of experience in web development, specializing in the blockchain and Web3 space. They have held titles including Full Stack Engineer, Lead Full Stack Engineer, and Front-End Engineer across companies like Treasure, Developer DAO, Hyype, Inc, and SevenStar, Inc. Mulf possesses strong skills in Typescript, Node.js, React/Next.js, Go, SQL, AWS services, and blockchain technologies like Solidity and Smart Contract Development. They have a proven track record of building scalable architectures, optimizing performance (e.g., 20% front-end performance enhancement), achieving cost reductions (e.g., 10% in backend operations), and leading significant initiatives like the launch of the Developer DAO website and ecosystem migrations. Their experience spans frontend development, backend architecture, cloud infrastructure, and smart contract integration, making them a versatile candidate for Senior or Staff level engineering roles, particularly within the blockchain domain.',
      },
    };

    setResumeData(mockData);
    setLoading(false);
  }, []);

  // Group skills by category
  const categorizeSkills = (skills: Skill[]) => {
    const categorized: Record<string, Skill[]> = {
      frontend: [],
      backend: [],
      cloud: [],
      blockchain: [],
      other: [],
    };

    skills.forEach((skill) => {
      let found = false;
      for (const [category, categorySkills] of Object.entries(skillCategories)) {
        if (categorySkills.includes(skill)) {
          categorized[category].push(skill);
          found = true;
          break;
        }
      }
      if (!found) {
        categorized.other.push(skill);
      }
    });

    return categorized;
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading resume data...</div>;
  }

  if (!resumeData) {
    return <div className="text-red-500">Failed to load resume data</div>;
  }

  const { data } = resumeData;
  const categorizedSkills = categorizeSkills(data.skills);

  // Calculate years for experience timeline
  const calculateYearRange = () => {
    const startYear = Number.parseInt(
      data.experience[data.experience.length - 1].start_date.split('-')[0]
    );
    const endYear = new Date().getFullYear();
    return { startYear, endYear, range: endYear - startYear };
  };

  const yearRange = calculateYearRange();

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Resume Analysis</h1>
        <div className="flex flex-wrap gap-3 mb-4">
          <Badge color="blue">
            {data.career_level.charAt(0).toUpperCase() + data.career_level.slice(1)} Level
          </Badge>
          <Badge color="purple">{data.total_experience_years.toFixed(1)} Years Experience</Badge>
          <Badge color="emerald">
            {data.category
              .replace('/', ' / ')
              .split(' ')
              .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ')}
          </Badge>
        </div>
      </div>

      {/* Summary Section */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Professional Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <Text>{data.summary}</Text>
        </CardContent>
      </Card>

      {/* Skills Section */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Skills & Technologies</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Object.entries(categorizedSkills).map(
              ([category, skills]) =>
                skills.length > 0 && (
                  <div key={category} className="space-y-2">
                    <h3 className="text-lg font-semibold capitalize">{category}</h3>
                    <div className="flex flex-wrap gap-2">
                      {skills.map((skill) => (
                        <Badge
                          key={skill}
                          color={
                            category === 'frontend'
                              ? 'sky'
                              : category === 'backend'
                                ? 'emerald'
                                : category === 'cloud'
                                  ? 'amber'
                                  : category === 'blockchain'
                                    ? 'purple'
                                    : 'zinc'
                          }
                        >
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )
            )}
          </div>
        </CardContent>
      </Card>

      {/* Experience Timeline */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Professional Experience</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700 ml-6 md:ml-8"></div>

            {data.experience.map((job, index) => (
              <div key={index} className="mb-8 relative">
                <div className="flex items-start">
                  {/* Timeline dot */}
                  <div className="absolute left-0 w-3 h-3 rounded-full bg-purple-600 mt-1.5 ml-4.5 md:ml-6.5"></div>

                  {/* Content */}
                  <div className="ml-16 md:ml-20">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-2">
                      <h3 className="text-xl font-bold">{job.title}</h3>
                      <div className="text-sm text-gray-500 dark:text-gray-400 md:text-right">
                        {job.start_date.substring(0, 7)} — {job.end_date}
                        <span className="ml-2 text-purple-500">({job.duration_months} months)</span>
                      </div>
                    </div>

                    <div className="text-lg font-medium mb-3">{job.company}</div>

                    <ul className="list-disc pl-5 space-y-2">
                      {job.responsibilities.map((responsibility, idx) => (
                        <li key={idx} className="text-gray-700 dark:text-gray-300">
                          {responsibility}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Career Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Career Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
              <div className="text-4xl font-bold text-purple-600 mb-2">
                {data.total_experience_years.toFixed(1)}
              </div>
              <div className="text-gray-600 dark:text-gray-400">Years of Experience</div>
            </div>

            <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
              <div className="text-4xl font-bold text-purple-600 mb-2">{data.skills.length}</div>
              <div className="text-gray-600 dark:text-gray-400">Technical Skills</div>
            </div>

            <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
              <div className="text-4xl font-bold text-purple-600 mb-2">
                {data.experience.length}
              </div>
              <div className="text-gray-600 dark:text-gray-400">Companies</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
