import { NavLink, Outlet, useNavigate } from "react-router"
import { Avatar } from '~/components/avatar'
import {
  Dropdown,
  DropdownButton,
  DropdownDivider,
  DropdownItem,
  DropdownLabel,
  DropdownMenu,
} from '~/components/dropdown'
import { Navbar, NavbarItem, NavbarSection, NavbarSpacer } from '~/components/navbar'
import { Sidebar, SidebarBody, SidebarHeader, SidebarItem, SidebarSection } from '~/components/sidebar'
import { StackedLayout } from '~/components/stacked-layout'
import {
  ArrowRightStartOnRectangleIcon,
  Cog8ToothIcon,
  LightBulbIcon,
  ShieldCheckIcon,
  UserIcon,
} from '@heroicons/react/16/solid'
import { fetcher } from "~/core"
import { useEffect } from "react"

const navItems = [
  { label: 'Home', url: '/dashboard' },
  { label: 'Matches', url: '/dashboard/matches' },
]



export default function DashboardLayout() {
  const navigate = useNavigate();
  useEffect(() => {
    async function checkAuth() {
      try {
        await fetcher({ url: "/auth/me" })
      } catch {
        navigate("/login")
      }
    }
    checkAuth()
  }, [navigate])


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
                <Avatar src="https://placehold.jp/60/2a3079/ffffff/150x150.png?text=PFP%0A" square />
              </DropdownButton>
              <DropdownMenu className="min-w-64" anchor="bottom end">
                <DropdownItem href="/my-profile">
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
                  <DropdownLabel onClick={async () => {
                    console.log("clicked")
                    await fetcher({ url: "/logout" })
                    console.log("made request")
                    navigate("/login", { replace: true });
                    console.log("shouldnt have got here")
                  }}>Sign out</DropdownLabel>
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </NavbarSection>
        </Navbar>
      }
      sidebar={
        <Sidebar>
          <SidebarHeader>

          </SidebarHeader>
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
  )
}
