export function OfflineSyncProvider({
  children,
}: React.PropsWithChildren) {
  const { syncPendingMutations } = useOfflineSync();

  useEffect(() => {
    const handleOnline = () => {
      syncPendingMutations();
    };

    window.addEventListener("online", handleOnline);

    return () =>
      window.removeEventListener("online", handleOnline);
  }, [syncPendingMutations]);

  return (
    <OfflineSyncContext.Provider value={...}>
      {children}
    </OfflineSyncContext.Provider>
  );
}