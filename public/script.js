document.addEventListener("DOMContentLoaded", function(event) { 
	var btn = document.getElementById('clear-uuid')
	if (btn) {
		btn.addEventListener('click', function() {
			document.cookie = "uuid=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
			window.location = '/'
		})
	}
})
