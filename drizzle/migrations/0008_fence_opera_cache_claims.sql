CREATE OR REPLACE FUNCTION public.claim_opera_cache(p_key text, p_host text, p_token uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cached public.opera_response_cache; gate public.opera_upstream_gate;
BEGIN
  SELECT * INTO cached FROM public.opera_response_cache WHERE cache_key = p_key;
  IF cached.expires_at > now() AND cached.body_base64 IS NOT NULL THEN
    RETURN jsonb_build_object('kind','hit','body',cached.body_base64,'contentType',cached.content_type,'status',cached.status,'ttl',greatest(0,floor(extract(epoch FROM cached.expires_at-now()))));
  END IF;
  INSERT INTO public.opera_upstream_gate(host) VALUES(p_host) ON CONFLICT DO NOTHING;
  SELECT * INTO gate FROM public.opera_upstream_gate WHERE host = p_host FOR UPDATE;
  SELECT * INTO cached FROM public.opera_response_cache WHERE cache_key = p_key;
  IF cached.expires_at > now() AND cached.body_base64 IS NOT NULL THEN
    RETURN jsonb_build_object('kind','hit','body',cached.body_base64,'contentType',cached.content_type,'status',cached.status,'ttl',greatest(0,floor(extract(epoch FROM cached.expires_at-now()))));
  END IF;
  IF gate.blocked_until > now() THEN RETURN jsonb_build_object('kind','blocked','retryAt',gate.blocked_until); END IF;
  IF cached.lease_until > now() OR gate.next_request_at > now() THEN RETURN jsonb_build_object('kind','wait'); END IF;
  INSERT INTO public.opera_response_cache(cache_key,lease_token,lease_until)
    VALUES(p_key,p_token,now()+interval '40 seconds')
    ON CONFLICT(cache_key) DO UPDATE SET lease_token=p_token,lease_until=now()+interval '40 seconds';
  UPDATE public.opera_upstream_gate SET next_request_at=now()+interval '300 milliseconds' WHERE host=p_host;
  DELETE FROM public.opera_response_cache WHERE expires_at < now()-interval '1 hour' AND lease_until < now();
  RETURN jsonb_build_object('kind','fetch');
END $$;
REVOKE ALL ON FUNCTION public.claim_opera_cache(text,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_opera_cache(text,text,uuid) TO service_role;
CREATE INDEX opera_cache_expiry ON public.opera_response_cache(expires_at);