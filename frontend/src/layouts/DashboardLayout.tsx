import { NavLink, Outlet, useNavigate } from 'react-router';
import { Avatar } from '~/components/avatar';
import {
  Dropdown,
  DropdownButton,
  DropdownDivider,
  DropdownItem,
  DropdownLabel,
  DropdownMenu,
} from '~/components/dropdown';
import { Navbar, NavbarItem, NavbarSection, NavbarSpacer } from '~/components/navbar';
import {
  Sidebar,
  SidebarBody,
  SidebarHeader,
  SidebarItem,
  SidebarSection,
} from '~/components/sidebar';
import { StackedLayout } from '~/components/stacked-layout';

import ArrowRightStartOnRectangleIcon from '@heroicons/react/16/solid/ArrowRightStartOnRectangleIcon';
import Cog8ToothIcon from '@heroicons/react/16/solid/Cog8ToothIcon';
import LightBulbIcon from '@heroicons/react/16/solid/LightBulbIcon';
import ShieldCheckIcon from '@heroicons/react/16/solid/ShieldCheckIcon';
import UserIcon from '@heroicons/react/16/solid/UserIcon';

import { fetcher } from '~/core';
import { useEffect } from 'react';

const navItems = [
  { label: 'Home', url: '/dashboard' },
  { label: 'Matches', url: '/dashboard/matches' },
];

export default function DashboardLayout() {
  const navigate = useNavigate();
  useEffect(() => {
    async function checkAuth() {
      try {
        // FOR TESTING ONLY: Introduce a small delay
        await new Promise((resolve) => setTimeout(resolve, 500)); // 0.5 second delay

        console.log('Attempting /auth/me from DashboardLayout');
        await fetcher({ url: '/auth/me' });
        console.log('/auth/me successful from DashboardLayout');
        // ... your success logic (e.g., set authenticated state)
      } catch (error) {
        console.error('/auth/me failed in DashboardLayout:', error);
        navigate('/login');
      }
    }
    checkAuth();
  }, [navigate]);

  return (
    <StackedLayout
      navbar={
        <Navbar>
          <NavbarSection className="max-lg:hidden">
            {navItems.map(({ label, url }) => (
              <NavLink to={url}>
                <NavbarItem key={label} href={url}>
                  {label}
                </NavbarItem>
              </NavLink>
            ))}
          </NavbarSection>
          <NavbarSpacer />
          <NavbarSection>
            <Dropdown>
              <DropdownButton as={NavbarItem}>
                <Avatar src="/placeholder-pfp.jpeg" square />
              </DropdownButton>
              <DropdownMenu className="min-w-64" anchor="bottom end">
                <DropdownItem href="/dashboard/profile">
                  <UserIcon />
                  <DropdownLabel>My profile</DropdownLabel>
                </DropdownItem>
                <DropdownItem href="/settings">
                  <Cog8ToothIcon />
                  <DropdownLabel>Settings</DropdownLabel>
                </DropdownItem>
                <DropdownDivider />
                <DropdownItem href="/privacy-policy">
                  <ShieldCheckIcon />
                  <DropdownLabel>Privacy policy</DropdownLabel>
                </DropdownItem>
                <DropdownItem href="/share-feedback">
                  <LightBulbIcon />
                  <DropdownLabel>Share feedback</DropdownLabel>
                </DropdownItem>
                <DropdownDivider />
                <DropdownItem>
                  <ArrowRightStartOnRectangleIcon />
                  <DropdownLabel
                    onClick={async () => {
                      console.log('clicked');
                      await fetcher({ url: '/logout' });
                      console.log('made request');
                      navigate('/login', { replace: true });
                      console.log('shouldnt have got here');
                    }}
                  >
                    Sign out
                  </DropdownLabel>
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </NavbarSection>
        </Navbar>
      }
      sidebar={
        <Sidebar>
          <SidebarHeader></SidebarHeader>
          <SidebarBody>
            <SidebarSection>
              {navItems.map(({ label, url }) => (
                <SidebarItem key={label} href={url}>
                  {label}
                </SidebarItem>
              ))}
            </SidebarSection>
          </SidebarBody>
        </Sidebar>
      }
    >
      <Outlet />
    </StackedLayout>
  );
}
