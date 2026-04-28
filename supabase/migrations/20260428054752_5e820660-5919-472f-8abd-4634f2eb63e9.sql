
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, app_role) TO service_role;
-- Keep voting RPCs callable by anon (intentional public voting flow)
GRANT EXECUTE ON FUNCTION public.validate_token(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_votes(TEXT, JSONB) TO anon, authenticated;
