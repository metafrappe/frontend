// This folder is owned by the `shell` task. Exports are added here.
export { ShellApp } from './ShellApp';
export { AppShell } from './layout/AppShell';
export { PageHeader } from './header/PageHeader';
export type { HeaderState, PageHeaderProps } from './header/PageHeader';
export { useFocusDim, FocusDimProvider } from './focus-dim';
export { routes, routePaths, queryKeys } from './paths';
export { ViewDataProvider, useViewData, createShellModuleEnvironment } from './view-data';
export type {
  CollectionAddress,
  ShellCollectionData,
  ShellModuleEnvironmentInput,
  ShellViewData,
} from './view-data';
