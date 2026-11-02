CREATE TABLE public.opera_response_cache (
  cache_key text PRIMARY KEY,
  body_base64 text,
  content_type text NOT NULL DEFAULT 'application/octet-stream',
  status integer NOT NULL DEFAULT 200,
  expires_at timestamptz NOT NULL DEFAULT now(),
  lease_token uuid,
  lease_until timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.opera_response_cache TO service_role;
ALTER TABLE public.opera_response_cache ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.opera_upstream_gate (
  host text PRIMARY KEY,
  next_request_at timestamptz NOT NULL DEFAULT now(),
  blocked_until timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.opera_upstream_gate TO service_role;
ALTER TABLE public.opera_upstream_gate ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.claim_opera_cache(p_key text, p_host text, p_token uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cached public.opera_response_cache; gate public.opera_upstream_gate;
BEGIN
  SELECT * INTO cached FROM public.opera_response_cache WHERE cache_key = p_key;
  IF cached.expires_at > now() AND cached.body_base64 IS NOT NULL THEN
    RETURN jsonb_build_object('kind','hit','body',cached.body_base64,'contentType',cached.content_type,'status',cached.status);
  END IF;
  INSERT INTO public.opera_upstream_gate(host) VALUES(p_host) ON CONFLICT DO NOTHING;
  SELECT * INTO gate FROM public.opera_upstream_gate WHERE host = p_host FOR UPDATE;
  IF gate.blocked_until > now() THEN
    RETURN jsonb_build_object('kind','blocked','retryAt',gate.blocked_until);
  END IF;
  IF cached.lease_until > now() THEN RETURN jsonb_build_object('kind','wait'); END IF;
  IF gate.next_request_at > now() THEN RETURN jsonb_build_object('kind','wait'); END IF;
  INSERT INTO public.opera_response_cache(cache_key,lease_token,lease_until)
    VALUES(p_key,p_token,now()+interval '40 seconds')
    ON CONFLICT(cache_key) DO UPDATE SET lease_token=p_token, lease_until=now()+interval '40 seconds';
  UPDATE public.opera_upstream_gate SET next_request_at=now()+interval '300 milliseconds' WHERE host=p_host;
  DELETE FROM public.opera_response_cache WHERE expires_at < now()-interval '1 hour' AND lease_until < now();
  RETURN jsonb_build_object('kind','fetch');
END $$;
REVOKE ALL ON FUNCTION public.claim_opera_cache(text,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_opera_cache(text,text,uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.finish_opera_cache(p_key text,p_token uuid,p_body text,p_type text,p_status integer,p_ttl integer,p_host text,p_retry integer DEFAULT 0)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.opera_response_cache SET body_base64=p_body,content_type=p_type,status=p_status,
    expires_at=now()+make_interval(secs=>p_ttl),lease_until=now(),lease_token=NULL
    WHERE cache_key=p_key AND lease_token=p_token;
  IF p_retry > 0 THEN UPDATE public.opera_upstream_gate SET blocked_until=greatest(blocked_until,now()+make_interval(secs=>p_retry)) WHERE host=p_host; END IF;
END $$;
REVOKE ALL ON FUNCTION public.finish_opera_cache(text,uuid,text,text,integer,integer,text,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_opera_cache(text,uuid,text,text,integer,integer,text,integer) TO service_role;