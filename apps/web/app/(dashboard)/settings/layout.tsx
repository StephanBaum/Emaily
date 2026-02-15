import { SettingsSidebar } from "@/components/settings/settings-sidebar";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full">
      <SettingsSidebar />
      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-3xl">{children}</div>
      </div>
    </div>
  );
}
