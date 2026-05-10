$base = 'http://localhost:5174'
$s = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$user = "smoke_$(Get-Random -Maximum 99999)"
$body = "username=$user&password=password123"
Write-Output "USER=$user"

function Post-Form($url, $body, $session) {
	try {
		$r = Invoke-WebRequest -Uri $url -Method POST -Body $body -ContentType 'application/x-www-form-urlencoded' -WebSession $session -MaximumRedirection 0 -ErrorAction Stop
		return [pscustomobject]@{ Status = $r.StatusCode; Location = $r.Headers.Location }
	} catch {
		$resp = $_.Exception.Response
		if ($resp) {
			return [pscustomobject]@{ Status = [int]$resp.StatusCode; Location = $resp.Headers['Location'] }
		}
		return [pscustomobject]@{ Status = -1; Location = $_.Exception.Message }
	}
}

$r1 = Post-Form "$base/register" $body $s
Write-Output "REG_STATUS=$($r1.Status) LOC=$($r1.Location)"

$r2 = Invoke-WebRequest -Uri "$base/" -UseBasicParsing -WebSession $s
Write-Output "HOME_HAS_HALLO=$($r2.Content -match 'Hallo,')"
Write-Output "HOME_HAS_USER=$($r2.Content -match $user)"

$r3 = Post-Form "$base/logout" '' $s
Write-Output "LOGOUT_STATUS=$($r3.Status) LOC=$($r3.Location)"

$r4 = Invoke-WebRequest -Uri "$base/" -UseBasicParsing -WebSession $s
Write-Output "HOME_AFTER_LOGOUT_GUEST=$($r4.Content -match 'Konto erstellen' -and -not ($r4.Content -match 'Hallo,'))"

$r5 = Post-Form "$base/login" $body $s
Write-Output "LOGIN_STATUS=$($r5.Status) LOC=$($r5.Location)"

$r6 = Invoke-WebRequest -Uri "$base/" -UseBasicParsing -WebSession $s
Write-Output "HOME_AFTER_LOGIN_HAS_USER=$($r6.Content -match $user)"
