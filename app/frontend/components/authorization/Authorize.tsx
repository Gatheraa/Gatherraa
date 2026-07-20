import { AuthorizationProps } from "../../types/authorization";
import { useAuthorization } from "../../hooks/useAuthorization";

export function Authorize({
    roles,
    permissions,
    featureFlag,
    walletOwner,
    fallback = null,
    children,
}: AuthorizationProps) {
    const {
        hasRole,
        hasPermission,
        hasFeature,
        ownsWallet,
    } = useAuthorization();

    const allowed =
        (!roles ||
            roles.some(hasRole)) &&
        (!permissions ||
            permissions.every(hasPermission)) &&
        (!featureFlag ||
            hasFeature(featureFlag)) &&
        (!walletOwner ||
            ownsWallet(walletOwner));

    return allowed ? <>{children}</> : <>{fallback}</>;
}